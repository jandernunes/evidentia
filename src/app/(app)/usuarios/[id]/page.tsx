import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveLabel } from "@/components/management";
import { RecordActions } from "@/components/record-actions";
import { PageHeading } from "@/components/ui";
import { managedUserScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
import { userFields } from "@/server/management";
import { UserForm } from "../forms";
export const metadata = { title: "Gerenciar usuário" };
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  const user = await getDb().user.findFirst({
    where: { id: (await params).id, ...managedUserScope(actor) },
    select: userFields,
  });
  if (!user) notFound();
  const canEdit = actor.role === "ADMIN" || user.createdById === actor.id;
  return (
    <>
      <PageHeading title={user.name} description="Dados e acesso do usuário." />
      <p>
        <ActiveLabel active={user.isActive} />
      </p>
      <section className="panel">
        <h2>Dados da conta</h2>
        {canEdit ? (
          <UserForm
            admin={actor.role === "ADMIN"}
            user={{ ...user, updatedAt: user.updatedAt.toISOString() }}
          />
        ) : (
          <>
            <p>{user.email}</p>
            <p>
              Este aluno participa da sua turma. A administração pode alterar os dados e o acesso
              desta conta.
            </p>
          </>
        )}
      </section>
      {canEdit && user.id !== actor.id && (
        <RecordActions
          resource="users"
          id={user.id}
          name={user.name}
          updatedAt={user.updatedAt.toISOString()}
          isActive={user.isActive}
          destination="/usuarios"
        />
      )}
      {user.id === actor.id && (
        <p className="notice">
          Seu próprio perfil e acesso não podem ser removidos nesta tela. Se alterar e-mail ou
          senha, entre novamente.
        </p>
      )}
      <Link href="/usuarios">Voltar à lista</Link>
    </>
  );
}
