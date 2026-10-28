import { parse } from "csv-parse/sync";
import { z } from "zod";
import {
  AppError,
  classScope,
  managedUserScope,
  requireTeacher,
  requireUser,
} from "@/server/access";
import { getDb } from "@/server/db";
import { advanceExam, answerExam, finishExam, ownedExam, reviewExam } from "@/server/exams";
import { exportResults } from "@/server/export-results";
import { api, readJson } from "@/server/http";
import {
  createClass,
  createCourse,
  createUser,
  deleteClass,
  deleteCourse,
  deleteUser,
  enrollStudent,
  managedRecord,
  removeEnrollment,
  updateClass,
  updateCourse,
  updateUser,
  userFields,
} from "@/server/management";
import { activityInput, disciplineInput, snapshotSchema } from "@/server/schemas";
import { releaseSubmission, submitWork } from "@/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const user = await requireUser();
    const [resource, id, action] = (await context.params).path;
    if (resource === "activities" && id && action === "results")
      return exportResults(id, user, new URL(request.url).searchParams.get("format") ?? "json");
    const db = getDb();
    if (["users", "courses", "classes"].includes(resource) && id) {
      const record = await managedRecord(resource, id, user);
      if (!record) throw new AppError(404, "NOT_FOUND", "Cadastro não encontrado.");
      return record;
    }
    if (resource === "users")
      return db.user.findMany({
        where: managedUserScope(user),
        select: userFields,
        orderBy: { name: "asc" },
        take: 200,
      });
    if (resource === "courses") return db.course.findMany({ orderBy: { name: "asc" }, take: 200 });
    if (resource === "disciplines")
      return db.discipline.findMany({ orderBy: { name: "asc" }, take: 200 });
    if (resource === "classes")
      return db.classroom.findMany({
        where: classScope(user),
        include: { courses: true, discipline: true, _count: { select: { enrollments: true } } },
        take: 100,
      });
    if (resource === "exams" && id) {
      const exam = await ownedExam(id, user);
      const showEvidence = user.role !== "STUDENT" || exam.resultReleased;
      return {
        id: exam.id,
        status: exam.status,
        version: exam.version,
        finishReason: exam.finishReason,
        resultReleased: exam.resultReleased,
        snapshot: snapshotSchema.parse(exam.snapshot),
        questions: exam.questions.map((q) => ({
          id: q.id,
          text: q.text,
          position: q.position,
          answer: q.answer
            ? { id: q.answer.id, text: q.answer.text, origin: q.answer.origin }
            : null,
        })),
        evidence: showEvidence ? exam.evidence : [],
        review: showEvidence ? (exam.reviews[0] ?? null) : null,
      };
    }
    throw new AppError(404, "NOT_FOUND", "Recurso não encontrado.");
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    const user = await requireUser();
    const [resource, id, action] = (await context.params).path;
    const input = await readJson(request);
    const db = getDb();
    if (resource === "courses" && !id) return createCourse(user, input);
    if (resource === "users" && !id) return createUser(user, input);
    if (resource === "disciplines" && !id) {
      requireTeacher(user);
      return db.discipline.create({ data: disciplineInput.parse(input) });
    }
    if (resource === "classes" && !id) {
      return createClass(user, input);
    }
    if (resource === "classes" && action === "enrollments") return enrollStudent(user, id, input);
    if (resource === "classes" && action === "import") {
      requireTeacher(user);
      const classroom = await db.classroom.findFirst({ where: { id, ...classScope(user) } });
      if (!classroom) throw new AppError(404, "NOT_FOUND", "Turma não encontrada.");
      if (!classroom.isActive)
        throw new AppError(409, "INACTIVE", "Reative a turma antes de cadastrar participantes.");
      const { csv } = z.object({ csv: z.string().max(50_000) }).parse(input);
      let rows: Record<string, string>[];
      try {
        rows = parse(csv, {
          columns: true,
          skip_empty_lines: true,
          bom: true,
          trim: true,
          max_record_size: 2000,
        });
      } catch {
        throw new AppError(
          400,
          "INVALID_CSV",
          "Confira o CSV: cabeçalho matricula,nome,email e uma pessoa por linha.",
        );
      }
      if (rows.length > 200)
        throw new AppError(400, "TOO_MANY_ROWS", "Importe até 200 participantes por vez.");
      const report = [];
      for (const [index, row] of rows.entries()) {
        const parsed = z
          .object({
            matricula: z.string().min(1).max(60),
            nome: z.string().min(2).max(160),
            email: z.email(),
          })
          .safeParse(row);
        if (!parsed.success) {
          report.push({
            line: index + 2,
            status: "rejeitado",
            reason: "Confira matrícula, nome e e-mail.",
          });
          continue;
        }
        const student = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (student?.role !== "STUDENT" || !student.isActive) {
          report.push({
            line: index + 2,
            status: "rejeitado",
            reason: "É necessária uma conta ativa de estudante já cadastrada.",
          });
          continue;
        }
        try {
          const existing = await db.enrollment.findUnique({
            where: { classroomId_studentId: { classroomId: id, studentId: student.id } },
          });
          if (existing && existing.registration !== parsed.data.matricula)
            throw new Error("Conflicting registration");
          await enrollStudent(user, id, {
            email: parsed.data.email,
            registration: parsed.data.matricula,
          });
          report.push({
            line: index + 2,
            status: existing ? "ignorado" : "incluido",
            reason: existing ? "Participante já vinculado." : "Participante vinculado.",
          });
        } catch {
          report.push({
            line: index + 2,
            status: "rejeitado",
            reason: "Matrícula ou vínculo em conflito. Confira a turma.",
          });
        }
      }
      return { report };
    }
    if (resource === "activities" && !id) {
      requireTeacher(user);
      const data = activityInput.parse(input);
      const classroom = await db.classroom.findFirst({
        where: { id: data.classroomId, isActive: true, ...classScope(user) },
      });
      if (!classroom) throw new AppError(404, "NOT_FOUND", "Turma não encontrada.");
      return db.activity.create({ data });
    }
    if (resource === "activities" && action === "submit") return submitWork(id, user, input);
    if (resource === "submissions" && action === "release")
      return releaseSubmission(id, user, input);
    if (resource === "exams") {
      if (action === "answers") return answerExam(id, user, input);
      if (action === "advance") return advanceExam(id, user);
      if (action === "finish") return finishExam(id, user);
      if (action === "review") return reviewExam(id, user, input);
    }
    throw new AppError(404, "NOT_FOUND", "Ação não encontrada.");
  });
}
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    const [resource, id] = (await context.params).path;
    if (!id) throw new AppError(404, "NOT_FOUND", "Cadastro não encontrado.");
    if (resource === "courses") return updateCourse(user, id, input);
    if (resource === "classes") return updateClass(user, id, input);
    if (resource === "users") return updateUser(user, id, input);
    throw new AppError(404, "NOT_FOUND", "Cadastro não encontrado.");
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    const [resource, id, action, target] = (await context.params).path;
    if (!id) throw new AppError(404, "NOT_FOUND", "Cadastro não encontrado.");
    if (resource === "classes" && action === "enrollments" && target)
      return removeEnrollment(user, id, target);
    if (resource === "courses") return deleteCourse(user, id, input);
    if (resource === "classes") return deleteClass(user, id, input);
    if (resource === "users") return deleteUser(user, id, input);
    throw new AppError(404, "NOT_FOUND", "Cadastro não encontrado.");
  });
}
