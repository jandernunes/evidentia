import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui";
import { pageUser } from "@/server/access";
import { CourseForm } from "../forms";
export const metadata = { title: "Cadastrar curso" };
export default async function NewCourse() {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  return (
    <>
      <PageHeading title="Cadastrar curso" description="Informe o nome e o nível de formação." />
      <section className="panel">
        <CourseForm />
      </section>
      <Link href="/cursos">Voltar aos cursos</Link>
    </>
  );
}
