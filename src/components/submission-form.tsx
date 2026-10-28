"use client";

import { useId, useRef, useState } from "react";
import { ApiForm, Field } from "./forms";
import { FormattedWork } from "./formatted-work";

const formats = [
  { label: "Negrito", before: "**", after: "**", sample: "texto em negrito" },
  { label: "Itálico", before: "*", after: "*", sample: "texto em itálico" },
  { label: "Título", before: "\n## ", after: "\n", sample: "Título da seção" },
  { label: "Lista", before: "\n- ", after: "\n", sample: "Item da lista" },
  { label: "Citação", before: "\n> ", after: "\n", sample: "Trecho citado" },
  { label: "Código", before: "\n```\n", after: "\n```\n", sample: "código" },
];

export function SubmissionForm({
  activityId,
  classmates,
}: {
  activityId: string;
  classmates: { id: string; name: string }[];
}) {
  const id = useId();
  const editor = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [isTeam, setIsTeam] = useState(false);
  const [formattingError, setFormattingError] = useState("");
  function format(item: (typeof formats)[number]) {
    const field = editor.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = content.slice(start, end) || item.sample;
    const next = content.slice(0, start) + item.before + selected + item.after + content.slice(end);
    if (next.length > 20_000) {
      setFormattingError(
        "A formatação ultrapassa o limite de 20.000 caracteres. Reduza o texto antes de continuar.",
      );
      return;
    }
    setFormattingError("");
    setContent(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(
        start + item.before.length,
        start + item.before.length + selected.length,
      );
    });
  }
  return (
    <ApiForm
      endpoint={`/api/v1/activities/${activityId}/submit`}
      label="Enviar trabalho"
      pendingLabel="Enviando…"
      resetOnSuccess={false}
      transform={(values) => ({
        content: values.get("content"),
        contentFormat: "MARKDOWN",
        driveUrl: values.get("driveUrl"),
        isTeam,
        teammateIds: isTeam ? values.getAll("teammateIds") : [],
      })}
      confirmMessage={(values) =>
        isTeam
          ? `Enviar uma única entrega para você e ${values.getAll("teammateIds").length} colega(s)? Todos terão acesso ao texto. O link do Drive ficará disponível para consulta do professor. A arguição será individual. Confira os integrantes antes de enviar.`
          : undefined
      }
    >
      <div className="field">
        <label htmlFor={`${id}-content`}>Conteúdo do trabalho</label>
        <p id={`${id}-help`} className="hint">
          Escreva entre 50 e 20.000 caracteres. Use a barra para formatar o texto em Markdown e
          confira a prévia antes de enviar.
        </p>
        <fieldset className="formatting-actions">
          <legend className="sr-only">Formatação do trabalho</legend>
          {formats.map((item) => (
            <button
              className="button secondary"
              type="button"
              key={item.label}
              onClick={() => format(item)}
            >
              {item.label}
            </button>
          ))}
          <button
            className="button secondary"
            type="button"
            aria-expanded={preview}
            aria-controls={`${id}-preview`}
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Ocultar prévia" : "Ver prévia"}
          </button>
        </fieldset>
        <textarea
          ref={editor}
          id={`${id}-content`}
          name="content"
          rows={14}
          required
          minLength={50}
          maxLength={20_000}
          className="resize-none work-editor"
          aria-describedby={`${id}-help ${id}-count`}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setFormattingError("");
          }}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              !event.altKey &&
              ["b", "i"].includes(event.key.toLowerCase())
            ) {
              event.preventDefault();
              format(formats[event.key.toLowerCase() === "b" ? 0 : 1]);
            }
          }}
        />
        <p role="alert" className="form-message error">
          {formattingError}
        </p>
        <div id={`${id}-preview`} hidden={!preview} className="work-preview">
          <h3>Prévia do trabalho</h3>
          {content.trim() ? (
            <FormattedWork content={content} format="MARKDOWN" />
          ) : (
            <p>Escreva o conteúdo para conferir a formatação.</p>
          )}
        </div>
        <p className="hint" id={`${id}-count`}>
          {content.length.toLocaleString("pt-BR")} de 20.000 caracteres.
        </p>
      </div>
      <Field
        name="driveUrl"
        type="url"
        required={false}
        label="Link do Google Drive"
        hint="Cole o link do arquivo ou da pasta e conceda acesso ao professor. A IA usará somente o texto acima; os materiais do link ficam disponíveis para consulta."
      />
      <fieldset>
        <legend>Participação no trabalho</legend>
        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={isTeam}
            onChange={(event) => setIsTeam(event.target.checked)}
            aria-controls={`${id}-team`}
            aria-expanded={isTeam}
          />
          Este trabalho é em equipe
        </label>
        <div id={`${id}-team`} hidden={!isTeam}>
          <p className="hint">
            Você já está incluído. Selecione os demais integrantes. Cada aluno terá sua própria
            arguição e resultado.
          </p>
          {classmates.length ? (
            classmates.map((student) => (
              <label className="checkbox-option" key={student.id}>
                <input type="checkbox" name="teammateIds" value={student.id} disabled={!isTeam} />
                {student.name}
              </label>
            ))
          ) : (
            <p>
              Nenhum colega disponível. Só aparecem alunos ativos da turma que ainda não possuem
              entrega nesta atividade.
            </p>
          )}
        </div>
      </fieldset>
      <p className="hint">
        Confira o texto e os integrantes. Depois do envio, a entrega ficará disponível para consulta
        e liberação da arguição pelo professor.
      </p>
    </ApiForm>
  );
}
