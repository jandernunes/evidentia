import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, classScope, managedUserScope, requireTeacher } from "./access";
import { getDb } from "./db";
import {
  classInput,
  classUpdateInput,
  courseInput,
  courseUpdateInput,
  enrollmentInput,
  newUserInput,
  userUpdateInput,
} from "./schemas";

export type Manager = { id: string; role: string };
export const userFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdById: true,
  updatedAt: true,
  createdAt: true,
} as const;
const versionInput = z.object({ updatedAt: z.iso.datetime() }).strict();
function version(record: { updatedAt: Date }, expected: string) {
  if (record.updatedAt.toISOString() !== expected)
    throw new AppError(
      409,
      "STALE_RECORD",
      "Este cadastro foi alterado. Atualize a página antes de salvar.",
    );
}
async function manage<T>(actor: Manager, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  requireTeacher(actor);
  return getDb().$transaction(async (tx) => {
    // Serializa mudanças de acesso e impede que dois administradores se desativem simultaneamente.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(260126)`;
    const current = await tx.user.findUnique({
      where: { id: actor.id },
      select: { role: true, isActive: true },
    });
    if (!current?.isActive || current.role !== actor.role)
      throw new AppError(
        403,
        "ACCESS_CHANGED",
        "Seu acesso mudou. Entre novamente para continuar.",
      );
    return work(tx);
  });
}
async function classroom(tx: Prisma.TransactionClient, id: string, actor: Manager) {
  const record = await tx.classroom.findFirst({ where: { id, ...classScope(actor) } });
  if (!record) throw new AppError(404, "NOT_FOUND", "Turma não encontrada.");
  return record;
}
async function userToEdit(tx: Prisma.TransactionClient, id: string, actor: Manager) {
  const record = await tx.user.findFirst({
    where: { id, ...(actor.role === "ADMIN" ? {} : { role: "STUDENT", createdById: actor.id }) },
  });
  if (!record)
    throw new AppError(404, "NOT_FOUND", "Usuário não encontrado ou sem permissão de alteração.");
  return record;
}
async function validateClassReferences(
  tx: Prisma.TransactionClient,
  courseIds: string[],
  disciplineId: string,
  teacherId: string,
  existingClassId?: string,
) {
  const ids = [...new Set(courseIds)];
  const [count, discipline, teacher] = await Promise.all([
    tx.course.count({
      where: {
        id: { in: ids },
        OR: [
          { isActive: true },
          ...(existingClassId ? [{ classes: { some: { id: existingClassId } } }] : []),
        ],
      },
    }),
    tx.discipline.findUnique({ where: { id: disciplineId } }),
    tx.user.findFirst({
      where: { id: teacherId, isActive: true, role: { in: ["ADMIN", "TEACHER"] } },
    }),
  ]);
  if (count !== ids.length || !discipline || !teacher)
    throw new AppError(
      400,
      "INVALID_REFERENCE",
      "Selecione cursos ativos, uma disciplina e um docente ativo.",
    );
  return ids;
}
export async function createCourse(actor: Manager, input: unknown) {
  const data = courseInput.strict().parse(input);
  return manage(actor, (tx) => tx.course.create({ data: { ...data, createdById: actor.id } }));
}
export async function updateCourse(actor: Manager, id: string, input: unknown) {
  const { updatedAt, ...data } = courseUpdateInput.parse(input);
  return manage(actor, async (tx) => {
    const record = await tx.course.findFirst({
      where: { id, ...(actor.role === "ADMIN" ? {} : { createdById: actor.id }) },
    });
    if (!record)
      throw new AppError(404, "NOT_FOUND", "Curso não encontrado ou sem permissão de alteração.");
    version(record, updatedAt);
    return tx.course.update({ where: { id }, data });
  });
}
export async function deleteCourse(actor: Manager, id: string, input: unknown) {
  const data = versionInput.parse(input);
  return manage(actor, async (tx) => {
    const record = await tx.course.findFirst({
      where: { id, ...(actor.role === "ADMIN" ? {} : { createdById: actor.id }) },
      include: { _count: { select: { classes: true } } },
    });
    if (!record)
      throw new AppError(404, "NOT_FOUND", "Curso não encontrado ou sem permissão de alteração.");
    version(record, data.updatedAt);
    if (record._count.classes)
      throw new AppError(
        409,
        "HAS_DEPENDENCIES",
        "Este curso possui turmas. Desative o cadastro para preservar os vínculos.",
      );
    await tx.course.delete({ where: { id } });
    return { deleted: true };
  });
}
export async function createClass(actor: Manager, input: unknown) {
  const data = classInput.strict().parse(input);
  return manage(actor, async (tx) => {
    if (actor.role !== "ADMIN" && data.teacherId && data.teacherId !== actor.id)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Você só pode cadastrar turmas sob sua responsabilidade.",
      );
    const teacherId = actor.role === "ADMIN" ? (data.teacherId ?? actor.id) : actor.id;
    const ids = await validateClassReferences(tx, data.courseIds, data.disciplineId, teacherId);
    return tx.classroom.create({
      data: {
        name: data.name,
        period: data.period,
        disciplineId: data.disciplineId,
        teacherId,
        courses: { connect: ids.map((id) => ({ id })) },
      },
    });
  });
}
export async function updateClass(actor: Manager, id: string, input: unknown) {
  const { updatedAt, courseIds, ...data } = classUpdateInput.parse(input);
  return manage(actor, async (tx) => {
    const record = await classroom(tx, id, actor);
    version(record, updatedAt);
    if (actor.role !== "ADMIN" && data.teacherId && data.teacherId !== actor.id)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Somente a administração pode transferir uma turma para outro docente.",
      );
    const courses =
      courseIds ??
      (
        await tx.course.findMany({ where: { classes: { some: { id } } }, select: { id: true } })
      ).map((c) => c.id);
    if (courseIds || data.disciplineId || data.teacherId)
      await validateClassReferences(
        tx,
        courses,
        data.disciplineId ?? record.disciplineId,
        data.teacherId ?? record.teacherId,
        id,
      );
    return tx.classroom.update({
      where: { id },
      data: {
        ...data,
        ...(courseIds ? { courses: { set: [...new Set(courseIds)].map((id) => ({ id })) } } : {}),
      },
    });
  });
}
export async function deleteClass(actor: Manager, id: string, input: unknown) {
  const data = versionInput.parse(input);
  return manage(actor, async (tx) => {
    const record = await classroom(tx, id, actor);
    version(record, data.updatedAt);
    const [enrollments, activities] = await Promise.all([
      tx.enrollment.count({ where: { classroomId: id } }),
      tx.activity.count({ where: { classroomId: id } }),
    ]);
    if (enrollments || activities)
      throw new AppError(
        409,
        "HAS_DEPENDENCIES",
        "Esta turma possui participantes ou atividades. Desative-a para preservar o histórico.",
      );
    await tx.classroom.delete({ where: { id } });
    return { deleted: true };
  });
}
export async function createUser(actor: Manager, input: unknown) {
  const data = newUserInput.parse(input);
  if (actor.role !== "ADMIN" && data.role !== "STUDENT")
    throw new AppError(403, "FORBIDDEN", "O professor pode cadastrar somente alunos.");
  requireTeacher(actor);
  const password = await hashPassword(data.password);
  return manage(actor, async (tx) => {
    if (data.classroomId && (data.role !== "STUDENT" || !data.registration))
      throw new AppError(
        400,
        "INVALID_ENROLLMENT",
        "Para vincular à turma, informe uma matrícula e o perfil de estudante.",
      );
    if (data.classroomId) {
      const record = await classroom(tx, data.classroomId, actor);
      if (!record.isActive)
        throw new AppError(409, "INACTIVE", "Reative a turma antes de cadastrar participantes.");
    }
    const id = crypto.randomUUID();
    return tx.user.create({
      data: {
        id,
        name: data.name,
        email: data.email,
        role: data.role,
        createdById: actor.id,
        accounts: {
          create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password },
        },
        ...(data.classroomId
          ? {
              enrollments: {
                create: {
                  classroomId: data.classroomId,
                  registration: z.string().min(1).parse(data.registration),
                },
              },
            }
          : {}),
      },
      select: userFields,
    });
  });
}
export async function updateUser(actor: Manager, id: string, input: unknown) {
  const { updatedAt, password, ...data } = userUpdateInput.parse(input);
  requireTeacher(actor);
  if (actor.role !== "ADMIN" && data.role && data.role !== "STUDENT")
    throw new AppError(403, "FORBIDDEN", "O professor não pode atribuir outros perfis.");
  const hashed = password ? await hashPassword(password) : undefined;
  return manage(actor, async (tx) => {
    const record = await userToEdit(tx, id, actor);
    version(record, updatedAt);
    if (id === actor.id && (data.isActive === false || (data.role && data.role !== record.role)))
      throw new AppError(
        409,
        "SELF_ACCESS",
        "Você não pode desativar sua conta ou alterar seu próprio perfil.",
      );
    if (data.role && data.role !== record.role) {
      const links = await tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          _count: {
            select: {
              classes: true,
              enrollments: true,
              submissions: true,
              submissionMemberships: true,
              reviews: true,
              createdUsers: true,
              createdCourses: true,
            },
          },
        },
      });
      if (Object.values(links._count).some(Boolean))
        throw new AppError(
          409,
          "HAS_DEPENDENCIES",
          "Este usuário possui vínculos acadêmicos. Preserve o perfil e, se necessário, desative a conta.",
        );
    }
    const result = await tx.user.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select: userFields,
    });
    if (hashed) {
      const account = await tx.account.findFirst({
        where: { userId: id, providerId: "credential" },
      });
      if (account)
        await tx.account.update({ where: { id: account.id }, data: { password: hashed } });
      else
        await tx.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: id,
            providerId: "credential",
            accountId: id,
            password: hashed,
          },
        });
    }
    if (
      hashed ||
      data.isActive === false ||
      (data.email && data.email !== record.email) ||
      (data.role && data.role !== record.role)
    )
      await tx.session.deleteMany({ where: { userId: id } });
    return result;
  });
}
export async function deleteUser(actor: Manager, id: string, input: unknown) {
  const data = versionInput.parse(input);
  return manage(actor, async (tx) => {
    const record = await userToEdit(tx, id, actor);
    version(record, data.updatedAt);
    if (id === actor.id)
      throw new AppError(409, "SELF_ACCESS", "Você não pode excluir sua própria conta.");
    const links = await tx.user.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            classes: true,
            enrollments: true,
            submissions: true,
            submissionMemberships: true,
            reviews: true,
            createdUsers: true,
            createdCourses: true,
          },
        },
      },
    });
    if (Object.values(links._count).some(Boolean))
      throw new AppError(
        409,
        "HAS_DEPENDENCIES",
        "Este usuário possui vínculos acadêmicos. Desative a conta para preservar o histórico.",
      );
    await tx.user.delete({ where: { id } });
    return { deleted: true };
  });
}
export async function enrollStudent(actor: Manager, id: string, input: unknown) {
  const data = enrollmentInput.parse(input);
  return manage(actor, async (tx) => {
    const record = await classroom(tx, id, actor);
    if (!record.isActive)
      throw new AppError(409, "INACTIVE", "Reative a turma antes de cadastrar participantes.");
    const student = await tx.user.findFirst({
      where: { email: data.email, role: "STUDENT", isActive: true },
    });
    if (!student)
      throw new AppError(
        400,
        "INVALID_STUDENT",
        "Não foi encontrada uma conta ativa de estudante com esse e-mail.",
      );
    const existing = await tx.enrollment.findUnique({
      where: { classroomId_studentId: { classroomId: id, studentId: student.id } },
    });
    if (existing && existing.registration !== data.registration)
      throw new AppError(409, "CONFLICT", "Esse aluno já está vinculado com outra matrícula.");
    return tx.enrollment.upsert({
      where: { classroomId_studentId: { classroomId: id, studentId: student.id } },
      create: { classroomId: id, studentId: student.id, registration: data.registration },
      update: {},
    });
  });
}
export async function removeEnrollment(actor: Manager, id: string, enrollmentId: string) {
  return manage(actor, async (tx) => {
    await classroom(tx, id, actor);
    const enrollment = await tx.enrollment.findFirst({
      where: { id: enrollmentId, classroomId: id },
    });
    if (!enrollment) throw new AppError(404, "NOT_FOUND", "Participante não encontrado.");
    if (
      await tx.submissionMember.count({
        where: { studentId: enrollment.studentId, submission: { activity: { classroomId: id } } },
      })
    )
      throw new AppError(
        409,
        "HAS_DEPENDENCIES",
        "Esse aluno já possui entregas nesta turma. O vínculo será preservado.",
      );
    await tx.enrollment.delete({ where: { id: enrollmentId } });
    return { deleted: true };
  });
}
export async function managedRecord(resource: string, id: string, actor: Manager) {
  requireTeacher(actor);
  const db = getDb();
  if (resource === "users")
    return db.user.findFirst({ where: { id, ...managedUserScope(actor) }, select: userFields });
  if (resource === "courses") return db.course.findUnique({ where: { id } });
  if (resource === "classes")
    return db.classroom.findFirst({
      where: { id, ...classScope(actor) },
      include: { courses: true, discipline: true, teacher: { select: { id: true, name: true } } },
    });
  return null;
}
