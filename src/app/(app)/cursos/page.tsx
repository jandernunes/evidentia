import Link from "next/link";
import { notFound } from "next/navigation";
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
import { pageUser } from "@/server/access";
import { getDb } from "@/server/db";
export const metadata = { title: "Cursos" };
export default async function CoursesPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  const params = await searchParams;
  const state = listState(params);
  const db = getDb();
  const where = {
    ...activeFilter(state.status),
    ...(state.q ? { name: { contains: state.q, mode: "insensitive" as const } } : {}),
  };
  const total = await db.course.count({ where });
  const page = Math.min(state.page, Math.max(1, Math.ceil(total / 20)));
  const courses = await db.course.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 20,
    include: { _count: { select: { classes: true } } },
  });
  return (
    <>
      <PageHeading
        title="Cursos"
        description="Cadastre cursos de qualquer área e mantenha o catálogo acadêmico."
        action={
          <Link className="button" href="/cursos/novo">
            Cadastrar curso
          </Link>
        }
      />
      <SavedNotice params={params} />
      <SearchToolbar q={state.q} status={state.status} label="Buscar curso" />
      <TableRegion label="Lista de cursos">
        <table>
          <caption>Cursos cadastrados</caption>
          <thead>
            <tr>
              <th scope="col">Curso</th>
              <th scope="col">Nível</th>
              <th scope="col">Turmas</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>{course.name}</td>
                <td>{course.level}</td>
                <td>{course._count.classes}</td>
                <td>
                  <ActiveLabel active={course.isActive} />
                </td>
                <td>
                  <Link href={`/cursos/${course.id}`}>
                    {actor.role === "ADMIN" || course.createdById === actor.id
                      ? "Gerenciar"
                      : "Consultar"}
                    <span className="sr-only"> {course.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!courses.length && (
          <p className="table-empty">
            Nenhum curso encontrado. Ajuste a busca ou cadastre um curso.
          </p>
        )}
      </TableRegion>
      <Pagination {...state} page={page} total={total} base="/cursos" />
    </>
  );
}
