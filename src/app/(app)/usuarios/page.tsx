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
import { managedUserScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
export const metadata = { title: "Gestão de usuários" };
const labels: Record<string, string> = {
  ADMIN: "Administrador",
  TEACHER: "Professor",
  STUDENT: "Estudante",
};
export default async function UsersPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  const params = await searchParams;
  const state = listState(params);
  const db = getDb();
  const where = {
    AND: [
      managedUserScope(actor),
      activeFilter(state.status),
      ...(state.q
        ? [
            {
              OR: [
                { name: { contains: state.q, mode: "insensitive" as const } },
                { email: { contains: state.q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };
  const total = await db.user.count({ where });
  const page = Math.min(state.page, Math.max(1, Math.ceil(total / 20)));
  const users = await db.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdById: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
    skip: (page - 1) * 20,
  });
  return (
    <>
      <PageHeading
        title={actor.role === "ADMIN" ? "Usuários" : "Alunos"}
        description={
          actor.role === "ADMIN"
            ? "Gerencie os acessos de administradores, professores e estudantes."
            : "Cadastre alunos e consulte os participantes das suas turmas."
        }
        action={
          <Link className="button" href="/usuarios/novo">
            {actor.role === "ADMIN" ? "Cadastrar usuário" : "Cadastrar aluno"}
          </Link>
        }
      />
      <SavedNotice params={params} />
      <SearchToolbar q={state.q} status={state.status} label="Buscar por nome ou e-mail" />
      <TableRegion label="Lista de usuários">
        <table>
          <caption>
            {actor.role === "ADMIN"
              ? "Usuários cadastrados"
              : "Alunos cadastrados por você ou vinculados às suas turmas"}
          </caption>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Perfil</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{labels[user.role]}</td>
                <td>
                  <ActiveLabel active={user.isActive} />
                </td>
                <td>
                  <Link href={`/usuarios/${user.id}`}>
                    {actor.role === "ADMIN" || user.createdById === actor.id
                      ? "Gerenciar"
                      : "Consultar"}
                    <span className="sr-only"> {user.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && (
          <p className="table-empty">
            Nenhum usuário encontrado. Ajuste a busca ou cadastre um aluno.
          </p>
        )}
      </TableRegion>
      <Pagination {...state} page={page} total={total} base="/usuarios" />
    </>
  );
}
