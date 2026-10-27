import { z } from "zod";
import { AppError, classScope } from "./access";
import { getDb } from "./db";
import { generate } from "./llm";
import { answerInput, evidenceSchema, snapshotSchema, validateGeneration } from "./schemas";

type Actor = { id: string; role: string };
export async function ownedExam(id: string, user: Actor) {
  const exam = await getDb().exam.findFirst({
    where: {
      id,
      submission:
        user.role === "STUDENT"
          ? { studentId: user.id }
          : { activity: { classroom: classScope(user) } },
    },
    include: {
      submission: {
        include: {
          student: { select: { id: true, name: true } },
          activity: { include: { classroom: true } },
        },
      },
      questions: { orderBy: { position: "asc" }, include: { answer: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!exam) throw new AppError(404, "NOT_FOUND", "Sessão não encontrada.");
  return exam;
}
export async function answerExam(id: string, user: Actor, input: unknown) {
  const data = answerInput.parse(input);
  const db = getDb();
  await ownedExam(id, user);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Exam" WHERE id = ${id} FOR UPDATE`;
    const exam = await tx.exam.findUniqueOrThrow({
      where: { id },
      include: { questions: { orderBy: { position: "desc" }, take: 1, include: { answer: true } } },
    });
    const question = exam.questions[0];
    if (question?.id === data.questionId && question.answer?.text === data.text)
      return { saved: true, version: exam.version };
    if (
      exam.status !== "WAITING" ||
      exam.version !== data.version ||
      question?.id !== data.questionId ||
      question.answer
    )
      throw new AppError(409, "CONFLICT", "A sessão mudou. Atualize a página antes de responder.");
    await tx.answer.create({
      data: {
        questionId: question.id,
        text: data.text,
        origin: user.role === "STUDENT" ? "ESTUDANTE" : "TRANSCRITA_PELO_PROFESSOR",
        registeredBy: user.id,
      },
    });
    const updated = await tx.exam.update({
      where: { id },
      data: { status: "PENDING", version: { increment: 1 } },
    });
    return { saved: true, version: updated.version };
  });
}
export async function advanceExam(id: string, user: Actor) {
  const context = await ownedExam(id, user);
  if (!process.env.OPENAI_API_KEY || !process.env.LLM_MODEL)
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "A IA ainda não está configurada. A entrega e as respostas salvas permanecem disponíveis.",
    );
  const db = getDb();
  const token = crypto.randomUUID();
  const version = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Exam" WHERE id = ${id} FOR UPDATE`;
    const exam = await tx.exam.findUniqueOrThrow({ where: { id } });
    if (exam.generationAttempts >= 12)
      throw new AppError(
        429,
        "GENERATION_LIMIT",
        "O limite de tentativas desta sessão foi atingido. Procure o professor para revisar o histórico.",
      );
    if (
      !["PENDING", "PROCESSING"].includes(exam.status) ||
      (exam.status === "PROCESSING" && exam.leaseUntil && exam.leaseUntil > new Date())
    )
      throw new AppError(
        409,
        "PROCESSING",
        "A sessão já foi atualizada ou há uma pergunta em processamento.",
      );
    await tx.exam.update({
      where: { id },
      data: {
        status: "PROCESSING",
        generationAttempts: { increment: 1 },
        processingToken: token,
        leaseUntil: new Date(Date.now() + 60_000),
      },
    });
    return exam.version;
  });
  try {
    const snapshot = snapshotSchema.parse(context.snapshot);
    const output = validateGeneration(
      await generate(snapshot, context.questions),
      snapshot.objectives.map((o) => o.id),
      context.questions.flatMap((q) => (q.answer ? [q.answer.id] : [])),
    );
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Exam" WHERE id = ${id} FOR UPDATE`;
      const exam = await tx.exam.findUniqueOrThrow({ where: { id } });
      if (
        exam.processingToken !== token ||
        exam.version !== version ||
        exam.status !== "PROCESSING"
      )
        throw new AppError(
          409,
          "STALE_RESULT",
          "A sessão mudou durante o processamento. Atualize a página.",
        );
      const enough = snapshot.objectives.every((o) =>
        output.evidence.some((e) => e.objectiveId === o.id && e.state === "EVIDENCIA_SUFICIENTE"),
      );
      const atLimit = context.questions.length >= snapshot.maxQuestions;
      const finished = atLimit || (output.action === "FINISH" && enough);
      if (!finished && output.action !== "ASK") throw new Error("Missing next question");
      if (!finished)
        await tx.question.create({
          data: {
            examId: id,
            position: context.questions.length + 1,
            objectiveId: output.objectiveId,
            text: output.question,
            reason: output.reason,
          },
        });
      await tx.exam.update({
        where: { id },
        data: {
          evidence: output.evidence,
          status: finished ? "FINISHED" : "WAITING",
          finishReason: finished ? (atLimit ? "LIMITE_DE_PERGUNTAS" : "EVIDENCIAS_REUNIDAS") : null,
          processingToken: null,
          leaseUntil: null,
          version: { increment: 1 },
        },
      });
      return { processed: true };
    });
  } catch (error) {
    await db.exam.updateMany({
      where: { id, processingToken: token, status: "PROCESSING" },
      data: { status: "PENDING", processingToken: null, leaseUntil: null },
    });
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "AI_UNAVAILABLE",
      "Não foi possível gerar a próxima etapa. Sua resposta continua salva. Tente novamente.",
    );
  }
}
export async function finishExam(id: string, user: Actor) {
  await ownedExam(id, user);
  if (user.role === "STUDENT")
    throw new AppError(403, "FORBIDDEN", "O encerramento manual é feito pelo professor.");
  await getDb().exam.updateMany({
    where: { id, status: { not: "FINISHED" } },
    data: {
      status: "FINISHED",
      finishReason: "ENCERRADA_PELO_PROFESSOR",
      processingToken: null,
      leaseUntil: null,
      version: { increment: 1 },
    },
  });
  return { finished: true };
}
export async function reviewExam(id: string, user: Actor, input: unknown) {
  const exam = await ownedExam(id, user);
  if (user.role === "STUDENT")
    throw new AppError(403, "FORBIDDEN", "A revisão é feita pelo professor.");
  const data = z
    .object({
      reason: z.string().trim().min(5).max(3000),
      version: z.number().int(),
      decision: z.array(evidenceSchema).min(1).max(8),
      release: z.boolean(),
    })
    .parse(input);
  const snapshot = snapshotSchema.parse(exam.snapshot);
  validateGeneration(
    {
      action: "FINISH",
      objectiveId: "",
      question: "",
      reason: data.reason,
      evidence: data.decision,
    },
    snapshot.objectives.map((o) => o.id),
    exam.questions.flatMap((q) => (q.answer ? [q.answer.id] : [])),
  );
  if (data.decision.length !== snapshot.objectives.length)
    throw new AppError(400, "INCOMPLETE_REVIEW", "Revise todos os objetivos da atividade.");
  return getDb().$transaction(async (tx) => {
    const updated = await tx.exam.updateMany({
      where: { id, version: data.version, status: "FINISHED" },
      data: { resultReleased: data.release, version: { increment: 1 } },
    });
    if (!updated.count)
      throw new AppError(409, "CONFLICT", "Atualize a sessão antes de concluir a revisão.");
    await tx.review.create({
      data: { examId: id, teacherId: user.id, decision: data.decision, reason: data.reason },
    });
    return { reviewed: true };
  });
}
