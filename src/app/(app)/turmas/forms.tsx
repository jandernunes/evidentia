"use client";
import { ApiForm, Field } from "@/components/forms";

type Option = { id: string; name: string };
type ClassData = {
  id: string;
  name: string;
  period: string;
  disciplineId: string;
  teacherId: string;
  courses: Option[];
  updatedAt: string;
};
export function ClassForm({
  courses,
  disciplines,
  teachers,
  record,
}: {
  courses: Option[];
  disciplines: Option[];
  teachers?: Option[];
  record?: ClassData;
}) {
  return (
    <ApiForm
      endpoint={`/api/v1/classes${record ? `/${record.id}` : ""}`}
      method={record ? "PATCH" : "POST"}
      label={record ? "Salvar alterações" : "Criar turma"}
      destination="/turmas?salvo=1"
      confirmMessage={(data) =>
        record && teachers && data.get("teacherId") !== record.teacherId
          ? "Transferir a turma para o docente selecionado? O acesso à turma acompanha o responsável."
          : undefined
      }
      transform={(data) => ({
        name: data.get("name"),
        period: data.get("period"),
        disciplineId: data.get("disciplineId"),
        courseIds: data.getAll("courseIds"),
        ...(teachers ? { teacherId: data.get("teacherId") } : {}),
        ...(record ? { updatedAt: record.updatedAt } : {}),
      })}
    >
      <Field label="Nome da turma" name="name" defaultValue={record?.name} />
      <Field
        label="Período"
        name="period"
        hint="Por exemplo: 2026.2."
        defaultValue={record?.period}
      />
      <Field label="Disciplina" name="disciplineId" defaultValue={record?.disciplineId ?? ""}>
        <option value="">Selecione uma disciplina</option>
        {disciplines.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Field>
      {teachers && (
        <Field label="Docente responsável" name="teacherId" defaultValue={record?.teacherId ?? ""}>
          <option value="">Selecione o responsável</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Field>
      )}
      <fieldset>
        <legend>Cursos da turma</legend>
        {courses.map((c) => (
          <label key={c.id} className="checkbox-option">
            <input
              type="checkbox"
              name="courseIds"
              value={c.id}
              defaultChecked={record?.courses.some((selected) => selected.id === c.id)}
            />
            {c.name}
          </label>
        ))}
        <p className="hint">
          Selecione pelo menos um. A turma pode reunir estudantes de cursos diferentes.
        </p>
      </fieldset>
    </ApiForm>
  );
}
