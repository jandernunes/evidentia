import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/forms";
import { FormattedWork } from "@/components/formatted-work";
import { SubmissionForm } from "@/components/submission-form";
import { PageHeading } from "@/components/ui";
import { classScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
import { objectiveSchema } from "@/server/schemas";
export const metadata = { title: "Consultar atividade" };
export default async function ActivityDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const { id } = await params;
  const activity = await getDb().activity.findFirst({
    where: { id, classroom: classScope(user) },
    include: {
      classroom: { include: { discipline: true, courses: true } },
      submissions: {
        where: user.role === "STUDENT" ? { members: { some: { studentId: user.id } } } : {},
        include: {
          student: { select: { name: true } },
          members: {
            include: { student: { select: { id: true, name: true } } },
            orderBy: { student: { name: "asc" } },
          },
          exams: {
            where: user.role === "STUDENT" ? { studentId: user.id } : {},
            select: { id: true, studentId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      },
    },
  });
  if (!activity) notFound();
  const classmates =
    user.role === "STUDENT" && !activity.submissions.length
      ? await getDb().user.findMany({
          where: {
            id: { not: user.id },
            role: "STUDENT",
            isActive: true,
            enrollments: { some: { classroomId: activity.classroomId } },
            submissionMemberships: { none: { activityId: id } },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];
  const objectives = z.array(objectiveSchema).parse(activity.objectives);
  return (
    <>
      <PageHeading
        title={activity.title}
        description={`${activity.classroom.discipline.name} · ${activity.classroom.name}`}
      />
      <section className="panel">
        <h2>Instruções</h2>
        <p className="prose">{activity.instructions}</p>
        <p className="meta">
          {activity.classroom.courses.map((c) => `${c.name} (${c.level})`).join(", ")}
        </p>
        <h2>Objetivos e critérios</h2>
        {objectives.map((o) => (
          <div className="objective" key={o.id}>
            <h3>{o.description}</h3>
            <p>{o.criterion}</p>
          </div>
        ))}
        <p className="meta">
          Até {activity.maxQuestions} perguntas. A conclusão depende da revisão docente.
        </p>
      </section>
      {user.role === "STUDENT" && !activity.submissions.length && (
        <section className="panel">
          <h2>Enviar trabalho</h2>
          <p>
            Apresente o trabalho no texto abaixo. Você também pode informar um link do Drive para o
            professor e indicar os colegas que participaram da entrega.
          </p>
          <SubmissionForm activityId={id} classmates={classmates} />
        </section>
      )}
      <section className="panel">
        <h2>{user.role === "STUDENT" ? "Sua entrega" : "Entregas da turma"}</h2>
        {!activity.submissions.length ? (
          <p>Nenhuma entrega recebida.</p>
        ) : (
          <ul className="list">
            {activity.submissions.map((s) => (
              <li key={s.id} className="submission-item">
                <div>
                  <h3>{s.members.map((member) => member.student.name).join(", ")}</h3>
                  <p className="meta">
                    {s.members.length > 1 ? "Entrega em equipe" : "Entrega individual"} · Enviada
                    por {s.student.name}
                  </p>
                  <p className="meta">
                    Recebida em{" "}
                    {s.createdAt.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
                  </p>
                  <details>
                    <summary>Consultar trabalho</summary>
                    <FormattedWork content={s.content} format={s.contentFormat} />
                  </details>
                  {user.role !== "STUDENT" && s.driveUrl && (
                    <p>
                      <a href={s.driveUrl} target="_blank" rel="noopener noreferrer">
                        Consultar materiais no Drive (abre em outra aba)
                      </a>
                    </p>
                  )}
                </div>
                <div className="stack">
                  {s.members
                    .filter((member) => user.role !== "STUDENT" || member.studentId === user.id)
                    .map((member) => {
                      const exam = s.exams.find((item) => item.studentId === member.studentId);
                      return (
                        <div key={member.studentId}>
                          {exam ? (
                            <Link className="button secondary" href={`/sessoes/${exam.id}`}>
                              Abrir sessão
                              {user.role !== "STUDENT" && s.members.length > 1
                                ? ` de ${member.student.name}`
                                : ""}
                            </Link>
                          ) : user.role !== "STUDENT" ? (
                            <ActionButton
                              endpoint={`/api/v1/submissions/${s.id}/release`}
                              label={
                                s.members.length > 1
                                  ? `Liberar arguição de ${member.student.name}`
                                  : "Liberar arguição"
                              }
                              data={{ studentId: member.studentId }}
                              destination="$exam"
                            />
                          ) : (
                            <span>Aguardando liberação do professor</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {user.role !== "STUDENT" && (
        <section className="panel">
          <h2>Exportar resultados</h2>
          <p>As exportações distinguem análise provisória e revisão docente.</p>
          <div className="inline-actions">
            <a className="button secondary" href={`/api/v1/activities/${id}/results?format=csv`}>
              Baixar CSV
            </a>
            <a className="button secondary" href={`/api/v1/activities/${id}/results?format=json`}>
              Baixar JSON
            </a>
          </div>
        </section>
      )}
      <Link href="/atividades">Voltar às atividades</Link>
    </>
  );
}
