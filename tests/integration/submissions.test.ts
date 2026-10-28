import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../src/server/db";
import { answerExam, ownedExam } from "../../src/server/exams";
import { exportResults } from "../../src/server/export-results";
import { removeEnrollment } from "../../src/server/management";
import { releaseSubmission, submitWork } from "../../src/server/submissions";

const db = getDb();
const content =
  "**Entrega compartilhada**. A decisão considera os dados disponíveis e suas limitações, conforme o objetivo cadastrado.";
let teacher: { id: string; role: string };
let students: { id: string; role: string }[];
let activityId: string;
let classroomId: string;
beforeAll(() => {
  if (!process.env.DATABASE_URL?.endsWith("/evidentia_test"))
    throw Error("Use somente a base sintética.");
});
beforeEach(async () => {
  const stamp = crypto.randomUUID();
  teacher = await db.user.create({
    data: {
      id: `teacher-${stamp}`,
      name: "Docente sintético",
      email: `teacher-${stamp}@example.test`,
      role: "TEACHER",
    },
  });
  students = await Promise.all(
    [0, 1, 2, 3].map((n) =>
      db.user.create({
        data: {
          id: `student-${n}-${stamp}`,
          name: `Aluno ${n}`,
          email: `student-${n}-${stamp}@example.test`,
          role: "STUDENT",
        },
      }),
    ),
  );
  const classroom = await db.classroom.create({
    data: {
      name: "Turma sintética",
      period: "2026.2",
      teacher: { connect: { id: teacher.id } },
      discipline: { create: { name: `Disciplina ${stamp}` } },
      enrollments: {
        create: students
          .slice(0, 3)
          .map((student, n) => ({ studentId: student.id, registration: String(n) })),
      },
    },
  });
  classroomId = classroom.id;
  const activity = await db.activity.create({
    data: {
      classroomId,
      title: "Trabalho",
      instructions: "Explique e justifique a decisão.",
      objectives: [
        {
          id: "obj",
          description: "Justificar a decisão",
          criterion: "Reconhece as limitações dos dados.",
        },
      ],
    },
  });
  activityId = activity.id;
});
afterAll(() => db.$disconnect());

describe("entrega em equipe e arguição individual", () => {
  it("compartilha a entrega e isola respostas, sessões e exportação por aluno", async () => {
    const submission = await submitWork(activityId, students[0], {
      content,
      contentFormat: "MARKDOWN",
      driveUrl: "https://drive.google.com/drive/folders/exemplo",
      isTeam: true,
      teammateIds: [students[1].id],
    });
    expect(await db.submission.count({ where: { activityId } })).toBe(1);
    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(2);
    const first = await releaseSubmission(submission.id, teacher, { studentId: students[0].id });
    const second = await releaseSubmission(submission.id, teacher, { studentId: students[1].id });
    expect(first.id).not.toBe(second.id);
    expect(
      (await releaseSubmission(submission.id, teacher, { studentId: students[1].id })).id,
    ).toBe(second.id);
    const own = await ownedExam(second.id, students[1]);
    expect(own.snapshot).toMatchObject({
      work: content,
      examinee: { id: students[1].id },
      workFormat: "MARKDOWN",
    });
    expect(own.snapshot).not.toHaveProperty("driveUrl");
    await expect(ownedExam(first.id, students[1])).rejects.toMatchObject({ status: 404 });
    await expect(ownedExam(second.id, students[0])).rejects.toMatchObject({ status: 404 });
    const q = await db.question.create({
      data: {
        examId: first.id,
        position: 1,
        objectiveId: "obj",
        text: "Por que essa decisão?",
        reason: "Verificar justificativa.",
      },
    });
    await db.exam.update({ where: { id: first.id }, data: { status: "WAITING" } });
    await expect(
      answerExam(first.id, students[1], {
        questionId: q.id,
        text: "Tentativa do colega",
        version: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await answerExam(first.id, students[0], {
      questionId: q.id,
      text: "Minha explicação individual.",
      version: 0,
    });
    expect((await ownedExam(second.id, students[1])).questions).toHaveLength(0);
    const response = await exportResults(activityId, teacher, "json");
    const exported = await response.json();
    expect(exported.results).toHaveLength(2);
    expect(
      exported.results.map((row: { student: { id: string } }) => row.student.id).sort(),
    ).toEqual(
      students
        .slice(0, 2)
        .map((s) => s.id)
        .sort(),
    );
    expect(
      exported.results.find((row: { examId: string }) => row.examId === second.id).history,
    ).toEqual([]);
    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { classroomId_studentId: { classroomId, studentId: students[1].id } },
    });
    await expect(removeEnrollment(teacher, classroomId, enrollment.id)).rejects.toMatchObject({
      code: "HAS_DEPENDENCIES",
    });
  });
  it("rejeita colegas de fora da turma, inativos, o próprio autor e acesso de outro docente", async () => {
    await expect(
      submitWork(activityId, students[0], { content, isTeam: true, teammateIds: [students[3].id] }),
    ).rejects.toMatchObject({ code: "INVALID_TEAM" });
    await db.user.update({ where: { id: students[1].id }, data: { isActive: false } });
    await expect(
      submitWork(activityId, students[0], { content, isTeam: true, teammateIds: [students[1].id] }),
    ).rejects.toMatchObject({ code: "INVALID_TEAM" });
    await expect(
      submitWork(activityId, students[0], { content, isTeam: true, teammateIds: [students[0].id] }),
    ).rejects.toMatchObject({ code: "INVALID_TEAM" });
    const submission = await submitWork(activityId, students[0], { content });
    await expect(
      releaseSubmission(submission.id, { id: "other", role: "TEACHER" }, {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      releaseSubmission(submission.id, teacher, { studentId: students[2].id }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(releaseSubmission(submission.id, students[0], {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("impede participação simultânea em entregas diferentes sem criar entregas parciais", async () => {
    const attempts = await Promise.allSettled([
      submitWork(activityId, students[0], { content, isTeam: true, teammateIds: [students[1].id] }),
      submitWork(activityId, students[2], { content, isTeam: true, teammateIds: [students[1].id] }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(await db.submission.count({ where: { activityId } })).toBe(1);
    expect(await db.submissionMember.count({ where: { activityId } })).toBe(2);
  });
});
