import { stringify } from "csv-stringify/sync";
import { z } from "zod";
import { AppError, classScope, requireTeacher } from "./access";
import { getDb } from "./db";
import { csvSafe, evidenceSchema, objectiveSchema, snapshotSchema } from "./schemas";

export async function exportResults(
  activityId: string,
  user: { id: string; role: string },
  format: string,
) {
  requireTeacher(user);
  if (!["csv", "json"].includes(format))
    throw new AppError(400, "INVALID_FORMAT", "Escolha CSV ou JSON.");
  const activity = await getDb().activity.findFirst({
    where: { id: activityId, classroom: classScope(user) },
    include: {
      classroom: { include: { discipline: true, courses: true } },
      submissions: {
        take: 201,
        orderBy: { createdAt: "asc" },
        include: {
          members: {
            include: { student: { select: { id: true, name: true } } },
            orderBy: { student: { name: "asc" } },
          },
          exams: {
            include: {
              questions: { orderBy: { position: "asc" }, include: { answer: true } },
              reviews: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!activity) throw new AppError(404, "NOT_FOUND", "Atividade não encontrada.");
  if (activity.submissions.length > 200)
    throw new AppError(413, "EXPORT_LIMIT", "Esta versão exporta até 200 entregas por atividade.");
  const results = activity.submissions.flatMap((submission) =>
    submission.members.map((member) => {
      const exam = submission.exams.find((item) => item.studentId === member.studentId);
      const review = exam?.reviews[0];
      return {
        student: member.student,
        submissionId: submission.id,
        participants: submission.members.map((item) => item.student),
        driveUrl: submission.driveUrl,
        submittedAt: submission.createdAt.toISOString(),
        examId: exam?.id ?? null,
        status: exam?.status ?? "AGUARDANDO_LIBERACAO",
        reviewed: Boolean(review),
        resultReleased: exam?.resultReleased ?? false,
        objectives: exam
          ? snapshotSchema.parse(exam.snapshot).objectives
          : z.array(objectiveSchema).parse(activity.objectives),
        suggestion: exam ? z.array(evidenceSchema).parse(exam.evidence) : [],
        decision: review ? z.array(evidenceSchema).parse(review.decision) : null,
        reviewReason: review?.reason ?? null,
        history:
          exam?.questions.map((q) => ({
            questionId: q.id,
            position: q.position,
            objectiveId: q.objectiveId,
            question: q.text,
            answer: q.answer
              ? {
                  id: q.answer.id,
                  text: q.answer.text,
                  origin: q.answer.origin,
                  registeredBy: q.answer.registeredBy,
                  createdAt: q.answer.createdAt.toISOString(),
                }
              : null,
          })) ?? [],
      };
    }),
  );
  if (format === "json")
    return Response.json(
      {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        activity: {
          id: activity.id,
          title: activity.title,
          classroom: activity.classroom.name,
          discipline: activity.classroom.discipline.name,
          courses: activity.classroom.courses.map((c) => c.name),
        },
        results,
      },
      { headers: { "Content-Disposition": 'attachment; filename="evidentia-resultados.json"' } },
    );
  const rows = results.flatMap((result) =>
    result.objectives.map((objective) => {
      const evidence = (result.decision ?? result.suggestion).find(
        (e) => e.objectiveId === objective.id,
      );
      return {
        curso: activity.classroom.courses.map((c) => c.name).join("; "),
        disciplina: activity.classroom.discipline.name,
        turma: activity.classroom.name,
        atividade: activity.title,
        estudante: result.student.name,
        objetivo: objective.description,
        estado: evidence?.state ?? "NAO_AVALIADO",
        justificativa: evidence?.reason ?? "Sem evidência registrada.",
        revisao: result.reviewed ? "REVISADO" : "REVISAO_PENDENTE",
        respostas: evidence?.answerIds.join("; ") ?? "",
      };
    }),
  );
  const safeRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, csvSafe(value)])),
  );
  return new Response(
    stringify(safeRows, {
      header: true,
      bom: true,
      columns: [
        "curso",
        "disciplina",
        "turma",
        "atividade",
        "estudante",
        "objetivo",
        "estado",
        "justificativa",
        "revisao",
        "respostas",
      ],
    }),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="evidentia-resultados.csv"',
      },
    },
  );
}
