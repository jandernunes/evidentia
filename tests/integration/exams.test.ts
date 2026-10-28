import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../src/server/db";
import { advanceExam, answerExam, finishExam, ownedExam } from "../../src/server/exams";
import { generate } from "../../src/server/llm";

vi.mock("../../src/server/llm", () => ({ generate: vi.fn() }));

const db = getDb();
const snapshot = {
  title: "Interpretação",
  instructions: "Explique a decisão.",
  discipline: "Leitura",
  courses: ["Letras"],
  maxQuestions: 3,
  objectives: [
    {
      id: "objective-1",
      description: "Justificar a interpretação",
      criterion: "Explica com base no texto.",
    },
  ],
  work: "Material sintético para teste.",
};
let fixture: {
  examId: string;
  questionId: string;
  teacher: { id: string; role: string };
  student: { id: string; role: string };
};
beforeAll(() => {
  if (!process.env.DATABASE_URL?.endsWith("/evidentia_test"))
    throw new Error("Execute somente no banco sintético evidentia_test.");
  vi.stubEnv("OPENAI_API_KEY", "fixture-never-sent-to-provider");
  vi.stubEnv("LLM_MODEL", "fixture-model");
});
beforeEach(async () => {
  vi.mocked(generate).mockReset();
  const stamp = crypto.randomUUID();
  const teacher = await db.user.create({
    data: {
      id: `teacher-${stamp}`,
      name: "Docente sintético",
      email: `teacher-${stamp}@example.test`,
      role: "TEACHER",
    },
  });
  const student = await db.user.create({
    data: {
      id: `student-${stamp}`,
      name: "Estudante sintético",
      email: `student-${stamp}@example.test`,
    },
  });
  const classroom = await db.classroom.create({
    data: {
      name: "Teste de integridade",
      period: "2026.2",
      teacher: { connect: { id: teacher.id } },
      discipline: { create: { name: `Leitura ${stamp}` } },
    },
  });
  await db.enrollment.create({
    data: { classroomId: classroom.id, studentId: student.id, registration: stamp },
  });
  const activity = await db.activity.create({
    data: {
      classroomId: classroom.id,
      title: "Análise",
      instructions: "Justifique suas escolhas.",
      objectives: snapshot.objectives,
    },
  });
  const submission = await db.submission.create({
    data: {
      activityId: activity.id,
      studentId: student.id,
      content: snapshot.work,
      members: { create: { studentId: student.id } },
    },
  });
  const exam = await db.exam.create({
    data: {
      submissionId: submission.id,
      studentId: student.id,
      snapshot,
      status: "WAITING",
      questions: {
        create: {
          position: 1,
          objectiveId: "objective-1",
          text: "Qual a justificativa?",
          reason: "Teste sintético.",
        },
      },
    },
    include: { questions: true },
  });
  fixture = { examId: exam.id, questionId: exam.questions[0].id, teacher, student };
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("integridade transacional das sessões", () => {
  it("persiste somente uma resposta em envios simultâneos idênticos", async () => {
    const input = {
      questionId: fixture.questionId,
      version: 0,
      text: "Minha justificativa usa as passagens finais do texto.",
    };
    await Promise.all([
      answerExam(fixture.examId, fixture.student, input),
      answerExam(fixture.examId, fixture.student, input),
    ]);
    expect(await db.answer.count({ where: { questionId: fixture.questionId } })).toBe(1);
    expect((await db.exam.findUniqueOrThrow({ where: { id: fixture.examId } })).version).toBe(1);
    await expect(
      answerExam(fixture.examId, fixture.student, {
        ...input,
        text: "Tentativa de substituir a resposta.",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("preserva a resposta após falha do provedor", async () => {
    await answerExam(fixture.examId, fixture.student, {
      questionId: fixture.questionId,
      version: 0,
      text: "Resposta confirmada antes da geração.",
    });
    vi.mocked(generate).mockRejectedValue(new Error("Synthetic provider failure"));
    await expect(advanceExam(fixture.examId, fixture.student)).rejects.toMatchObject({
      status: 503,
    });
    expect(
      (await db.answer.findUniqueOrThrow({ where: { questionId: fixture.questionId } })).text,
    ).toBe("Resposta confirmada antes da geração.");
    expect((await db.exam.findUniqueOrThrow({ where: { id: fixture.examId } })).status).toBe(
      "PENDING",
    );
  });
  it("publica uma próxima pergunta ligada a uma resposta existente", async () => {
    await answerExam(fixture.examId, fixture.student, {
      questionId: fixture.questionId,
      version: 0,
      text: "Explicação parcial registrada.",
    });
    const answer = await db.answer.findUniqueOrThrow({ where: { questionId: fixture.questionId } });
    vi.mocked(generate).mockResolvedValue({
      action: "ASK",
      objectiveId: "objective-1",
      question: "Qual passagem sustenta essa explicação?",
      reason: "Aprofundar justificativa.",
      evidence: [
        {
          objectiveId: "objective-1",
          state: "EVIDENCIA_PARCIAL",
          reason: "Há explicação parcial.",
          answerIds: [answer.id],
        },
      ],
    });
    await advanceExam(fixture.examId, fixture.student);
    expect(await db.question.count({ where: { examId: fixture.examId } })).toBe(2);
    expect((await db.exam.findUniqueOrThrow({ where: { id: fixture.examId } })).status).toBe(
      "WAITING",
    );
  });
  it("descarta retorno tardio depois de encerramento docente", async () => {
    await db.exam.update({ where: { id: fixture.examId }, data: { status: "PENDING" } });
    const gate = Promise.withResolvers<unknown>();
    const started = Promise.withResolvers<void>();
    vi.mocked(generate).mockImplementation(async () => {
      started.resolve();
      return gate.promise;
    });
    const request = advanceExam(fixture.examId, fixture.student);
    const rejected = expect(request).rejects.toMatchObject({ status: 409 });
    await started.promise;
    await expect(advanceExam(fixture.examId, fixture.student)).rejects.toMatchObject({
      status: 409,
    });
    await finishExam(fixture.examId, fixture.teacher);
    gate.resolve({
      action: "ASK",
      objectiveId: "objective-1",
      question: "Pergunta tardia que não deve ser publicada.",
      reason: "Caso de teste.",
      evidence: [],
    });
    await rejected;
    expect((await db.exam.findUniqueOrThrow({ where: { id: fixture.examId } })).status).toBe(
      "FINISHED",
    );
    expect(await db.question.count({ where: { examId: fixture.examId } })).toBe(1);
  });
  it("impõe limite de chamadas antes de consultar o provedor", async () => {
    await db.exam.update({
      where: { id: fixture.examId },
      data: { status: "PENDING", generationAttempts: 12 },
    });
    await expect(advanceExam(fixture.examId, fixture.student)).rejects.toMatchObject({
      status: 429,
    });
    expect(generate).not.toHaveBeenCalled();
  });
  it("não revela sessão a outro docente ou estudante", async () => {
    await expect(
      ownedExam(fixture.examId, { id: "another-teacher", role: "TEACHER" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      ownedExam(fixture.examId, { id: "another-student", role: "STUDENT" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
