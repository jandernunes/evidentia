import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveLabel } from "@/components/management";
import { RecordActions } from "@/components/record-actions";
import { PageHeading } from "@/components/ui";
import { pageUser } from "@/server/access";
import { getDb } from "@/server/db";
import { CourseForm } from "../forms";
export const metadata = { title: "Gerenciar curso" };
export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageUser();
  if (actor.role === "STUDENT") notFound();
  const course = await getDb().course.findUnique({ where: { id: (await params).id } });
  if (!course) notFound();
  const canEdit = actor.role === "ADMIN" || course.createdById === actor.id;
  return (
    <>
      <PageHeading title={course.name} description="Dados e situação do curso." />
      <p>
        <ActiveLabel active={course.isActive} />
      </p>
      <section className="panel">
        <h2>Dados do curso</h2>
        {canEdit ? (
          <CourseForm course={{ ...course, updatedAt: course.updatedAt.toISOString() }} />
        ) : (
          <>
            <p>{course.level}</p>
            <p>Somente quem cadastrou o curso ou a administração pode alterá-lo.</p>
          </>
        )}
      </section>
      {canEdit && (
        <RecordActions
          resource="courses"
          id={course.id}
          name={course.name}
          updatedAt={course.updatedAt.toISOString()}
          isActive={course.isActive}
          destination="/cursos"
        />
      )}
      <Link href="/cursos">Voltar aos cursos</Link>
    </>
  );
}
