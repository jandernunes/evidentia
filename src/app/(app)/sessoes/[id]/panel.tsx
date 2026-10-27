"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton, ApiForm, Field } from "@/components/forms";

type Evidence = { objectiveId: string; state: string; reason: string; answerIds: string[] };
const states: Record<string, string> = {
  NAO_AVALIADO: "Não avaliado",
  EVIDENCIA_INSUFICIENTE: "Evidência insuficiente",
  EVIDENCIA_PARCIAL: "Evidência parcial",
  EVIDENCIA_SUFICIENTE: "Evidência suficiente",
};
export function SessionPanel({
  examId,
  version,
  status,
  teacher,
  questions,
  objectives,
  evidence,
  previousReview,
}: {
  examId: string;
  version: number;
  status: string;
  teacher: boolean;
  questions: {
    id: string;
    text: string;
    position: number;
    answer: { id: string; text: string; origin: string } | null;
  }[];
  objectives: { id: string; description: string; criterion: string }[];
  evidence: Evidence[];
  previousReview: { reason: string; decision: Evidence[] } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const current = questions.at(-1);
  async function advance() {
    setPending(true);
    setError("");
    setMessage("Aguarde enquanto a próxima etapa é preparada.");
    try {
      const response = await fetch(`/api/v1/exams/${examId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMessage("Etapa atualizada.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente.");
    } finally {
      setPending(false);
      router.refresh();
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !current) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/v1/exams/${examId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: current.id, text: answer, version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMessage("Resposta salva. Você pode continuar para a próxima etapa.");
      setAnswer("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível confirmar o envio. Tente novamente com a mesma resposta.",
      );
    } finally {
      setPending(false);
    }
  }
  const finalEvidence = previousReview?.decision ?? evidence;
  return (
    <>
      <p role="status" className="status-line">
        {message}
      </p>
      <p role="alert" className="error">
        {error}
      </p>
      {(status === "PENDING" || status === "PROCESSING") && (
        <section className="panel">
          <h2>{questions.length ? "Continuar a arguição" : "Iniciar a arguição"}</h2>
          <p>
            As respostas confirmadas já estão salvas. Se houve uma interrupção, continue a partir
            daqui.
          </p>
          <button type="button" className="button" disabled={pending} onClick={advance}>
            {pending
              ? "Preparando…"
              : status === "PROCESSING"
                ? "Verificar e retomar"
                : "Preparar próxima pergunta"}
          </button>
        </section>
      )}
      {status === "WAITING" && current && !current.answer && (
        <section className="panel">
          <p className="meta">Pergunta {current.position}</p>
          <h2>{current.text}</h2>
          <form onSubmit={save} noValidate className="form-stack" aria-busy={pending}>
            <label htmlFor="answer">
              {teacher ? "Transcrição da resposta oral do estudante" : "Sua resposta"}
            </label>
            <textarea
              className="resize-none"
              id="answer"
              value={answer}
              maxLength={5000}
              onChange={(e) => setAnswer(e.target.value)}
              rows={7}
              aria-describedby="answer-help"
            />
            <p id="answer-help" className="hint">
              {teacher
                ? "O histórico identificará você como responsável pela transcrição."
                : "Explique seu raciocínio. A resposta será salva antes da próxima pergunta."}
            </p>
            <button className="button" type="submit" disabled={pending || !answer.trim()}>
              {pending ? "Salvando…" : teacher ? "Salvar transcrição" : "Salvar resposta"}
            </button>
          </form>
        </section>
      )}
      {questions.some((q) => q.answer) && (
        <section className="panel">
          <h2>Histórico de respostas</h2>
          {questions
            .filter((q) => q.answer)
            .map((q) => (
              <article className="history" key={q.id}>
                <h3>Pergunta {q.position}</h3>
                <p>{q.text}</p>
                <p className="prose">{q.answer?.text}</p>
                <p className="meta">
                  {q.answer?.origin === "ESTUDANTE"
                    ? "Resposta registrada pelo estudante"
                    : "Resposta transcrita pelo professor"}
                </p>
              </article>
            ))}
        </section>
      )}
      {teacher && status !== "FINISHED" && (
        <details className="panel">
          <summary>Encerramento pelo professor</summary>
          <p>
            A sessão será encerrada sem novas respostas. Objetivos não verificados continuarão
            identificados como lacunas.
          </p>
          <ActionButton endpoint={`/api/v1/exams/${examId}/finish`} label="Encerrar esta sessão" />
        </details>
      )}
      {(teacher || finalEvidence.length > 0) && (
        <section className="panel">
          <h2>Mapa de evidências</h2>
          <p>
            {previousReview
              ? "Decisão revisada pelo professor."
              : "Análise provisória. Ainda depende de revisão docente."}
          </p>
          {objectives.map((o) => {
            const item = finalEvidence.find((e) => e.objectiveId === o.id);
            return (
              <article className="objective" key={o.id}>
                <h3>{o.description}</h3>
                <p>{item ? states[item.state] : "Não avaliado"}</p>
                <p>{item?.reason || "Ainda não há evidência registrada para este objetivo."}</p>
                {item && item.answerIds.length > 0 && (
                  <p className="meta">
                    Base:{" "}
                    {item.answerIds
                      .map((id) => {
                        const question = questions.find((q) => q.answer?.id === id);
                        return `resposta à pergunta ${question?.position ?? "não localizada"}`;
                      })
                      .join(", ")}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
      {teacher && status === "FINISHED" && (
        <section className="panel">
          <h2>Revisar e liberar resultado</h2>
          <ApiForm
            endpoint={`/api/v1/exams/${examId}/review`}
            label="Salvar revisão"
            transform={(data) => ({
              version,
              reason: data.get("reason"),
              release: data.get("release") === "on",
              decision: objectives.map((o) => {
                return {
                  objectiveId: o.id,
                  state: data.get(`state-${o.id}`),
                  reason: String(data.get(`reason-${o.id}`)),
                  answerIds: data.getAll(`answers-${o.id}`).map(String),
                };
              }),
            })}
          >
            <div className="review-grid">
              {objectives.map((o) => (
                <fieldset key={o.id}>
                  <legend>{o.description}</legend>
                  <Field
                    label="Estado confirmado"
                    name={`state-${o.id}`}
                    defaultValue={
                      finalEvidence.find((e) => e.objectiveId === o.id)?.state || "NAO_AVALIADO"
                    }
                  >
                    {Object.entries(states).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Field>
                  <Field
                    label="Justificativa deste objetivo"
                    name={`reason-${o.id}`}
                    type="textarea"
                    defaultValue={
                      finalEvidence.find((e) => e.objectiveId === o.id)?.reason ||
                      "Objetivo não avaliado nesta sessão."
                    }
                  />
                  <p>Respostas que sustentam a decisão</p>
                  {questions
                    .filter((q) => q.answer)
                    .map((q) => (
                      <label className="checkbox-option" key={q.id}>
                        <input
                          type="checkbox"
                          name={`answers-${o.id}`}
                          value={q.answer?.id}
                          defaultChecked={finalEvidence
                            .find((e) => e.objectiveId === o.id)
                            ?.answerIds.includes(q.answer?.id ?? "")}
                        />
                        Resposta à pergunta {q.position}
                      </label>
                    ))}
                </fieldset>
              ))}
            </div>
            <Field
              name="reason"
              label="Justificativa da revisão"
              type="textarea"
              defaultValue={previousReview?.reason}
            />
            <label className="checkbox-option">
              <input type="checkbox" name="release" />
              Liberar o resultado ao estudante
            </label>
          </ApiForm>
        </section>
      )}
    </>
  );
}
