import { verifyPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../../src/server/db";
import {
  createClass,
  createCourse,
  createUser,
  deleteClass,
  deleteCourse,
  deleteUser,
  enrollStudent,
  type Manager,
  managedRecord,
  removeEnrollment,
  updateClass,
  updateCourse,
  updateUser,
} from "../../src/server/management";

const db = getDb();
const stamp = crypto.randomUUID();
const password = "Senha-sintetica-123456";
let admin: Manager, teacher: Manager, other: Manager, student: Manager;
let disciplineId: string;
const version = (record: { updatedAt: Date }) => ({ updatedAt: record.updatedAt.toISOString() });
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.endsWith("/evidentia_test"))
    throw Error("Use somente a base sintética.");
  const actors = await Promise.all(
    ["ADMIN", "TEACHER", "TEACHER", "STUDENT"].map((role, i) =>
      db.user.create({
        data: {
          id: crypto.randomUUID(),
          name: `Gestão ${i}`,
          email: `management-${stamp}-${i}@example.test`,
          role,
        },
      }),
    ),
  );
  [admin, teacher, other, student] = actors;
  disciplineId = (await db.discipline.create({ data: { name: `Gestão ${stamp}` } })).id;
});
afterAll(() => db.$disconnect());
describe("gestão acadêmica e de acessos", () => {
  it("cria os três perfis pelo administrador e limita professor a alunos", async () => {
    for (const role of ["ADMIN", "TEACHER", "STUDENT"]) {
      const created = await createUser(admin, {
        name: `Conta ${role}`,
        email: `${role}-${stamp}@example.test`,
        password,
        role,
      });
      expect(created.role).toBe(role);
      expect(created).not.toHaveProperty("accounts");
      const account = await db.account.findFirstOrThrow({ where: { userId: created.id } });
      expect(await verifyPassword({ hash: account.password ?? "", password })).toBe(true);
    }
    await expect(
      createUser(teacher, {
        name: "Escalada",
        email: `forged-${stamp}@example.test`,
        password,
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createUser(student, {
        name: "Aluno",
        email: `student-forged-${stamp}@example.test`,
        password,
        role: "STUDENT",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("aplica CRUD de cursos, propriedade e conflito de edição", async () => {
    const course = await createCourse(teacher, { name: `Curso ${stamp}`, level: "Graduação" });
    await expect(
      updateCourse(other, course.id, { ...version(course), name: "Intruso" }),
    ).rejects.toMatchObject({ status: 404 });
    const edited = await updateCourse(admin, course.id, {
      ...version(course),
      name: "Curso revisado",
    });
    await expect(deleteCourse(teacher, course.id, version(course))).rejects.toMatchObject({
      status: 409,
      code: "STALE_RECORD",
    });
    const inactive = await updateCourse(teacher, course.id, {
      ...version(edited),
      isActive: false,
    });
    expect(inactive.isActive).toBe(false);
    await deleteCourse(admin, course.id, version(inactive));
    expect(await db.course.findUnique({ where: { id: course.id } })).toBeNull();
  });
  it("limita turmas ao professor e permite administração e transferência", async () => {
    const course = await createCourse(teacher, {
      name: `Transferência ${stamp}`,
      level: "Mestrado",
    });
    const input = { name: "Turma inicial", period: "2026.2", disciplineId, courseIds: [course.id] };
    const assigned = await createClass(admin, { ...input, teacherId: teacher.id });
    expect(assigned.teacherId).toBe(teacher.id);
    await deleteClass(admin, assigned.id, version(assigned));
    await expect(createClass(teacher, { ...input, teacherId: other.id })).rejects.toMatchObject({
      status: 403,
    });
    const classroom = await createClass(teacher, input);
    expect(await managedRecord("classes", classroom.id, other)).toBeNull();
    await expect(
      updateClass(other, classroom.id, { ...version(classroom), name: "Intruso" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(deleteCourse(admin, course.id, version(course))).rejects.toMatchObject({
      code: "HAS_DEPENDENCIES",
    });
    const transferred = await updateClass(admin, classroom.id, {
      ...version(classroom),
      teacherId: other.id,
    });
    expect(await managedRecord("classes", classroom.id, teacher)).toBeNull();
    expect(await managedRecord("classes", classroom.id, other)).toMatchObject({
      teacherId: other.id,
    });
    await deleteClass(other, classroom.id, version(transferred));
    await deleteCourse(admin, course.id, version(course));
  });
  it("cadastra aluno com matrícula, preserva histórico e protege identidade compartilhada", async () => {
    const course = await createCourse(teacher, { name: `Matrículas ${stamp}`, level: "Graduação" });
    const classroom = await createClass(teacher, {
      name: "Turma de matrículas",
      period: "2026.2",
      disciplineId,
      courseIds: [course.id],
    });
    const email = `enrollment-${stamp}@example.test`;
    const created = await createUser(teacher, {
      name: "Aluno da turma",
      email,
      password,
      role: "STUDENT",
      classroomId: classroom.id,
      registration: "001",
    });
    const enrollment = await enrollStudent(teacher, classroom.id, { email, registration: "001" });
    expect(
      await db.enrollment.count({ where: { classroomId: classroom.id, studentId: created.id } }),
    ).toBe(1);
    await expect(
      enrollStudent(teacher, classroom.id, { email, registration: "002" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(deleteClass(teacher, classroom.id, version(classroom))).rejects.toMatchObject({
      code: "HAS_DEPENDENCIES",
    });
    await expect(deleteUser(teacher, created.id, version(created))).rejects.toMatchObject({
      code: "HAS_DEPENDENCIES",
    });
    await expect(
      updateUser(admin, created.id, { ...version(created), role: "TEACHER" }),
    ).rejects.toMatchObject({ code: "HAS_DEPENDENCIES" });
    const shared = await createUser(admin, {
      name: "Aluno compartilhado",
      email: `shared-${stamp}@example.test`,
      password,
      role: "STUDENT",
    });
    await enrollStudent(teacher, classroom.id, { email: shared.email, registration: "003" });
    expect(await managedRecord("users", shared.id, teacher)).toMatchObject({ id: shared.id });
    await expect(
      updateUser(teacher, shared.id, { ...version(shared), password }),
    ).rejects.toMatchObject({ status: 404 });
    const activity = await db.activity.create({
      data: {
        classroomId: classroom.id,
        title: "Atividade",
        instructions: "Justifique",
        objectives: [],
      },
    });
    await db.submission.create({
      data: { activityId: activity.id, studentId: created.id, content: "Resposta sintética" },
    });
    await expect(removeEnrollment(teacher, classroom.id, enrollment.id)).rejects.toMatchObject({
      code: "HAS_DEPENDENCIES",
    });
  });
  it("remove vínculo sem entregas e exclui contas sem dependências", async () => {
    const course = await createCourse(other, { name: `Exclusão ${stamp}`, level: "Graduação" });
    const classroom = await createClass(other, {
      name: "Temporária",
      period: "2026.2",
      disciplineId,
      courseIds: [course.id],
    });
    const user = await createUser(other, {
      name: "Aluno temporário",
      email: `temporary-${stamp}@example.test`,
      password,
      role: "STUDENT",
    });
    const enrollment = await enrollStudent(other, classroom.id, {
      email: user.email,
      registration: "tmp",
    });
    await removeEnrollment(other, classroom.id, enrollment.id);
    await deleteUser(other, user.id, version(user));
    await deleteClass(admin, classroom.id, version(classroom));
    await deleteCourse(other, course.id, version(course));
  });
  it("encerra sessões ao desativar e trocar senha; impede perda do próprio acesso", async () => {
    const user = await createUser(admin, {
      name: "Acesso controlado",
      email: `access-${stamp}@example.test`,
      password,
      role: "STUDENT",
    });
    await db.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const inactive = await updateUser(admin, user.id, { ...version(user), isActive: false });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    const active = await updateUser(admin, user.id, {
      ...version(inactive),
      isActive: true,
      password: "Outra-senha-sintetica-123",
    });
    const account = await db.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(
      await verifyPassword({ hash: account.password ?? "", password: "Outra-senha-sintetica-123" }),
    ).toBe(true);
    await expect(
      updateUser(other, user.id, { ...version(active), role: "ADMIN" }),
    ).rejects.toMatchObject({ status: 403 });
    const own = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    await expect(
      updateUser(admin, admin.id, { ...version(own), isActive: false }),
    ).rejects.toMatchObject({ code: "SELF_ACCESS" });
    await expect(
      updateUser(admin, admin.id, { ...version(own), role: "STUDENT" }),
    ).rejects.toMatchObject({ code: "SELF_ACCESS" });
    await expect(deleteUser(admin, admin.id, version(own))).rejects.toMatchObject({
      code: "SELF_ACCESS",
    });
  });
  it("recusa ações de atores desativados ou com perfil alterado durante a sessão", async () => {
    const stale = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name: "Desativado",
        email: `stale-${stamp}@example.test`,
        role: "TEACHER",
        isActive: false,
      },
    });
    await expect(
      createCourse(stale, { name: "Inválido", level: "Graduação" }),
    ).rejects.toMatchObject({ code: "ACCESS_CHANGED" });
  });
});
