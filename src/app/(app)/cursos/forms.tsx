"use client";
import { ApiForm, Field } from "@/components/forms";
export function CourseForm({
  course,
}: {
  course?: { id: string; name: string; level: string; updatedAt: string };
}) {
  return (
    <ApiForm
      endpoint={`/api/v1/courses${course ? `/${course.id}` : ""}`}
      method={course ? "PATCH" : "POST"}
      label={course ? "Salvar alterações" : "Cadastrar curso"}
      destination="/cursos?salvo=1"
      transform={(data) => ({
        name: data.get("name"),
        level: data.get("level"),
        ...(course ? { updatedAt: course.updatedAt } : {}),
      })}
    >
      <Field name="name" label="Nome do curso" defaultValue={course?.name} />
      <Field
        name="level"
        label="Nível de formação"
        defaultValue={course?.level}
        hint="Por exemplo: graduação, especialização, mestrado ou doutorado."
      />
    </ApiForm>
  );
}
