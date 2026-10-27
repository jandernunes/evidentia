import Link from "next/link";
import { z } from "zod";
import { PageHeading, statusLabels } from "@/components/ui";
import { pageUser } from "@/server/access";
import { ownedExam } from "@/server/exams";
import { evidenceSchema, snapshotSchema } from "@/server/schemas";
import { SessionPanel } from "./panel";
export const metadata = { title: "Sessão de microarguição" };
export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const exam = await ownedExam((await params).id, user);
  const snapshot = snapshotSchema.parse(exam.snapshot);
  const showEvidence = user.role !== "STUDENT" || exam.resultReleased;
  const evidence = showEvidence ? z.array(evidenceSchema).parse(exam.evidence) : [];
  return (
    <>
      <PageHeading
        title={snapshot.title}
        description={`${snapshot.discipline} · ${exam.submission.student.name}`}
      />
      <p className="notice">
        {statusLabels[exam.status]} · até {snapshot.maxQuestions} perguntas.{" "}
        {exam.status === "FINISHED" && !exam.resultReleased
          ? "Resultado aguardando revisão e liberação docente."
          : ""}
      </p>
      <SessionPanel
        examId={exam.id}
        version={exam.version}
        status={exam.status}
        teacher={user.role !== "STUDENT"}
        questions={exam.questions.map((q) => ({
          id: q.id,
          text: q.text,
          position: q.position,
          answer: q.answer
            ? { id: q.answer.id, text: q.answer.text, origin: q.answer.origin }
            : null,
        }))}
        objectives={snapshot.objectives}
        evidence={evidence}
        previousReview={
          showEvidence && exam.reviews[0]
            ? {
                reason: exam.reviews[0].reason,
                decision: z.array(evidenceSchema).parse(exam.reviews[0].decision),
              }
            : null
        }
      />
      <Link href={`/atividades/${exam.submission.activityId}`}>Voltar à atividade</Link>
    </>
  );
}
