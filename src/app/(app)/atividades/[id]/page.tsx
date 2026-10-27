import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton, ApiForm, Field } from "@/components/forms";
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
        where: user.role === "STUDENT" ? { studentId: user.id } : {},
        include: { student: { select: { name: true } }, exam: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      },
    },
  });
  if (!activity) notFound();
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
            Envie uma versão textual da entrega. Depois do envio, o professor poderá liberar sua
            arguição.
          </p>
          <ApiForm endpoint={`/api/v1/activities/${id}/submit`} label="Enviar trabalho">
            <Field
              name="content"
              label="Conteúdo do trabalho"
              type="textarea"
              hint="Entre 50 e 20.000 caracteres. Preserve explicações, decisões e referências relevantes."
            />
          </ApiForm>
        </section>
      )}
      <section className="panel">
        <h2>{user.role === "STUDENT" ? "Sua entrega" : "Entregas da turma"}</h2>
        {!activity.submissions.length ? (
          <p>Nenhuma entrega recebida.</p>
        ) : (
          <ul className="list">
            {activity.submissions.map((s) => (
              <li key={s.id}>
                <div>
                  <h3>{s.student.name}</h3>
                  <p className="meta">
                    Recebida em{" "}
                    {s.createdAt.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
                  </p>
                  {user.role !== "STUDENT" && (
                    <details>
                      <summary>Consultar trabalho</summary>
                      <p className="prose">{s.content}</p>
                    </details>
                  )}
                </div>
                {s.exam ? (
                  <Link className="button secondary" href={`/sessoes/${s.exam.id}`}>
                    Abrir sessão
                  </Link>
                ) : user.role !== "STUDENT" ? (
                  <ActionButton
                    endpoint={`/api/v1/submissions/${s.id}/release`}
                    label="Liberar arguição"
                    destination="$exam"
                  />
                ) : (
                  <span>Aguardando liberação do professor</span>
                )}
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
