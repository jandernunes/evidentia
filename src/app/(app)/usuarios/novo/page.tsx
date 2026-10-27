import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui";
import { classScope, pageUser } from "@/server/access";
import { getDb } from "@/server/db";
import { UserForm } from "../forms";
export const metadata = { title: "Cadastrar usuário" };
export default async function NewUserPage() {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  const classes = await getDb().classroom.findMany({
    where: { ...classScope(actor), isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeading
        title={actor.role === "ADMIN" ? "Cadastrar usuário" : "Cadastrar aluno"}
        description="Crie uma conta individual de acesso à aplicação."
      />
      <section className="panel">
        <UserForm admin={actor.role === "ADMIN"} classes={classes} />
      </section>
      <Link href="/usuarios">Voltar à lista</Link>
    </>
  );
}
