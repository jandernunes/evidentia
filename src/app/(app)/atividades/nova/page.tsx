import Link from "next/link";
import { Empty, PageHeading } from "@/components/ui";
import { classScope, pageUser, requireTeacher } from "@/server/access";
import { getDb } from "@/server/db";
import { ActivityForm } from "./form";
export const metadata = { title: "Criar atividade" };
export default async function NewActivity() {
  const user = await pageUser();
  requireTeacher(user);
  const classes = await getDb().classroom.findMany({
    where: { isActive: true, ...classScope(user) },
    orderBy: { name: "asc" },
    take: 200,
  });
  return (
    <>
      <PageHeading
        title="Criar atividade"
        description="Use os objetivos e critérios da sua disciplina."
      />
      {classes.length ? (
        <section className="panel">
          <ActivityForm classes={classes} />
        </section>
      ) : (
        <Empty
          title="Crie uma turma primeiro"
          description="A atividade precisa de uma turma e de um contexto acadêmico."
        >
          <Link className="button" href="/turmas">
            Cursos e turmas
          </Link>
        </Empty>
      )}
      <Link href="/atividades">Voltar às atividades</Link>
    </>
  );
}
