"use client";
import { ApiForm, Field } from "@/components/forms";
export function ActivityForm({ classes }: { classes: { id: string; name: string }[] }) {
  return (
    <ApiForm
      endpoint="/api/v1/activities"
      label="Criar atividade"
      destination="$id"
      transform={(data) => ({
        classroomId: data.get("classroomId"),
        title: data.get("title"),
        instructions: data.get("instructions"),
        maxQuestions: Number(data.get("maxQuestions")),
        objectives: String(data.get("objectives"))
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const [description, ...criterion] = line.split("|");
            return {
              id: crypto.randomUUID(),
              description: description.trim(),
              criterion: criterion.join("|").trim(),
            };
          }),
      })}
    >
      <Field name="classroomId" label="Turma">
        <option value="">Selecione uma turma</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Field>
      <Field name="title" label="Título da atividade" />
      <Field
        name="instructions"
        label="Instruções e contexto"
        type="textarea"
        hint="Descreva a tarefa, o nível da disciplina e o que o estudante deverá explicar."
      />
      <Field
        name="objectives"
        label="Objetivos e critérios"
        type="textarea"
        hint="Uma linha por objetivo, no formato: objetivo | critério observável. Exemplo: Justificar a escolha do método | Explica a escolha e reconhece suas limitações."
      />
      <Field name="maxQuestions" label="Limite de perguntas" defaultValue="5" type="number" />
    </ApiForm>
  );
}
