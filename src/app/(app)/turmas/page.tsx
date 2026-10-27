import Link from "next/link";
import {
  ActiveLabel,
  activeFilter,
  type ListParams,
  listState,
  Pagination,
  SavedNotice,
  SearchToolbar,
  TableRegion,
} from "@/components/management";
import { PageHeading } from "@/components/ui";
import { classScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
export const metadata = { title: "Turmas" };
export default async function ClassesPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const actor = await pageUser();
  const params = await searchParams;
  const state = listState(params);
  const db = getDb();
  const where = {
    ...classScope(actor),
    ...activeFilter(state.status),
    ...(state.q ? { name: { contains: state.q, mode: "insensitive" as const } } : {}),
  };
  const total = await db.classroom.count({ where });
  const page = Math.min(state.page, Math.max(1, Math.ceil(total / 20)));
  const classes = await db.classroom.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 20,
    include: {
      discipline: true,
      teacher: { select: { name: true } },
      _count: { select: { enrollments: true } },
    },
  });
  return (
    <>
      <PageHeading
        title="Turmas"
        description={
          actor.role === "ADMIN"
            ? "Gerencie as turmas da instituição e seus responsáveis."
            : "Consulte as turmas vinculadas à sua conta."
        }
        action={
          actor.role !== "STUDENT" ? (
            <Link className="button" href="/turmas/nova">
              Criar turma
            </Link>
          ) : undefined
        }
      />
      <SavedNotice params={params} />
      <SearchToolbar q={state.q} status={state.status} label="Buscar turma" />
      <TableRegion label="Lista de turmas">
        <table>
          <caption>Turmas cadastradas</caption>
          <thead>
            <tr>
              <th scope="col">Turma</th>
              <th scope="col">Disciplina</th>
              <th scope="col">Período</th>
              <th scope="col">Responsável</th>
              <th scope="col">Participantes</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.discipline.name}</td>
                <td>{c.period}</td>
                <td>{c.teacher.name}</td>
                <td>{c._count.enrollments}</td>
                <td>
                  <ActiveLabel active={c.isActive} />
                </td>
                <td>
                  <Link href={`/turmas/${c.id}`}>
                    {actor.role === "STUDENT" ? "Consultar" : "Gerenciar"}
                    <span className="sr-only"> {c.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!classes.length && <p className="table-empty">Nenhuma turma encontrada.</p>}
      </TableRegion>
      <Pagination {...state} page={page} total={total} base="/turmas" />
    </>
  );
}
