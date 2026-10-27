import Link from "next/link";
import { Empty, PageHeading, Steps } from "@/components/ui";
import { classScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
export const metadata = { title: "Atividades" };
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const user = await pageUser();
  const page = Math.max(1, Math.min(10000, Number((await searchParams).pagina) || 1));
  const where = { classroom: classScope(user) };
  const [activities, total] = await Promise.all([
    getDb().activity.findMany({
      where,
      include: {
        classroom: { include: { discipline: true, courses: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip: (page - 1) * 20,
    }),
    getDb().activity.count({ where }),
  ]);
  const teacher = user.role !== "STUDENT";
  return (
    <>
      <PageHeading
        title="Atividades"
        description="Prepare a atividade e acompanhe as evidências de aprendizagem."
        action={
          teacher && (
            <Link className="button" href="/atividades/nova">
              Criar atividade
            </Link>
          )
        }
      />
      <Steps />
      {!activities.length ? (
        <Empty
          title={teacher ? "Sua primeira atividade começa aqui" : "Suas atividades aparecerão aqui"}
          description={
            teacher
              ? "Defina a turma, os objetivos e os critérios de avaliação."
              : "O professor precisa vincular sua conta a uma turma com atividade."
          }
        >
          {teacher && (
            <Link className="button" href="/atividades/nova">
              Criar atividade
            </Link>
          )}
        </Empty>
      ) : (
        <>
          <ul className="list">
            {activities.map((a) => (
              <li key={a.id}>
                <div>
                  <h2>
                    <Link href={`/atividades/${a.id}`}>{a.title}</Link>
                  </h2>
                  <p>
                    {a.classroom.discipline.name} · {a.classroom.name}
                  </p>
                  <p className="meta">{a.classroom.courses.map((c) => c.name).join(", ")}</p>
                </div>
                <span className="meta">
                  {teacher ? `${a._count.submissions} entregas` : "Consultar atividade"}
                </span>
              </li>
            ))}
          </ul>
          <nav className="inline-actions" aria-label="Páginas de atividades">
            {page > 1 && <Link href={`?pagina=${page - 1}`}>Anterior</Link>}
            <span>
              Página {page} · {total} atividades
            </span>
            {page * 20 < total && <Link href={`?pagina=${page + 1}`}>Próxima</Link>}
          </nav>
        </>
      )}
      <p className="footnote">A conclusão é revisada pelo professor.</p>
    </>
  );
}
