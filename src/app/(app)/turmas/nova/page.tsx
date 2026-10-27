import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm, Field } from "@/components/forms";
import { PageHeading } from "@/components/ui";
import { pageUser } from "@/server/access";
import { getDb } from "@/server/db";
import { ClassForm } from "../forms";
export const metadata = { title: "Criar turma" };
export default async function NewClass() {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  const db = getDb();
  const [courses, disciplines, teachers] = await Promise.all([
    db.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.discipline.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    actor.role === "ADMIN"
      ? db.user.findMany({
          where: { isActive: true, role: { in: ["ADMIN", "TEACHER"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : undefined,
  ]);
  return (
    <>
      <PageHeading
        title="Criar turma"
        description="Defina o contexto acadêmico e os cursos que participam da turma."
      />
      <section className="panel">
        {courses.length && disciplines.length ? (
          <ClassForm courses={courses} disciplines={disciplines} teachers={teachers} />
        ) : (
          <p>Cadastre pelo menos um curso ativo e uma disciplina para criar a turma.</p>
        )}
        <p>
          <Link href="/cursos/novo">Cadastrar curso</Link>
        </p>
      </section>
      <section className="panel">
        <h2>Cadastrar disciplina</h2>
        <ApiForm endpoint="/api/v1/disciplines" label="Cadastrar disciplina">
          <Field label="Nome da disciplina" name="name" />
        </ApiForm>
      </section>
      <Link href="/turmas">Voltar à lista</Link>
    </>
  );
}
