"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useConfirmation } from "./confirmation";

export function Field({
  label,
  name,
  type = "text",
  required = true,
  hint,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const common = {
    id,
    name,
    required,
    defaultValue,
    "aria-describedby": hint ? `${id}-hint` : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {!required && <span> (opcional)</span>}
      </label>
      {children ? (
        <select {...common}>{children}</select>
      ) : type === "textarea" ? (
        <textarea {...common} rows={5} className="resize-none" />
      ) : (
        <input
          {...common}
          type={type}
          autoComplete={
            name === "email"
              ? "email"
              : name === "password"
                ? "current-password"
                : name === "newPassword"
                  ? "new-password"
                  : "off"
          }
        />
      )}{" "}
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}
export function ApiForm({
  endpoint,
  children,
  label = "Salvar",
  pendingLabel = "Salvando…",
  destination,
  transform,
  method = "POST",
  resetOnSuccess = true,
  confirmMessage,
}: {
  endpoint: string;
  children: ReactNode;
  label?: string;
  pendingLabel?: string;
  destination?: string;
  transform?: (data: FormData) => unknown;
  method?: "POST" | "PATCH";
  resetOnSuccess?: boolean;
  confirmMessage?: (data: FormData) => string | undefined;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const errorId = useId();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    setSuccess("");
    const invalid = Array.from(form.elements).find(
      (el) =>
        (el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement) &&
        !el.validity.valid,
    ) as HTMLInputElement | undefined;
    if (invalid) {
      setError("Confira os campos obrigatórios e os formatos informados.");
      invalid.setAttribute("aria-invalid", "true");
      invalid.focus();
      return;
    }
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
      el.removeAttribute("aria-invalid");
    });
    const question = confirmMessage?.(values);
    if (question && !(await confirm(question))) return;
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transform ? transform(values) : Object.fromEntries(values)),
      });
      const result = await response.json();
      if (!response.ok && endpoint.startsWith("/api/auth/"))
        throw new Error(
          response.status === 429
            ? "Muitas tentativas de acesso. Aguarde um momento e tente novamente."
            : "Não foi possível entrar. Confira seu e-mail e sua senha.",
        );
      if (!response.ok)
        throw new Error(result.message || "Não foi possível salvar. Confira os dados.");
      if (destination) {
        router.push(destination === "$id" ? `/atividades/${result.id}` : destination);
        router.refresh();
      } else {
        if (resetOnSuccess) form.reset();
        setSuccess(
          result.report
            ? result.report
                .map(
                  (r: { line: number; status: string; reason: string }) =>
                    `Linha ${r.line}: ${r.status}. ${r.reason}`,
                )
                .join("\n") || "Nenhum participante encontrado."
            : "Registro salvo.",
        );
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      {confirmation}
      <form
        method="post"
        onSubmit={submit}
        noValidate
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        className="form-stack"
      >
        {children}
        <p
          ref={errorRef}
          id={errorId}
          role={error ? "alert" : undefined}
          tabIndex={-1}
          className="form-message error"
        >
          {error}
        </p>
        <p role="status" className="form-message success">
          {success}
        </p>
        <button className="button" type="submit" disabled={pending || !ready}>
          {pending ? pendingLabel : label}
        </button>
      </form>
    </>
  );
}
export function ActionButton({
  endpoint,
  label,
  destination,
  data,
}: {
  endpoint: string;
  label: string;
  destination?: string;
  data?: Record<string, string>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function act() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      if (destination) router.push(destination === "$exam" ? `/sessoes/${result.id}` : destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button type="button" className="button" onClick={act} disabled={pending}>
        {pending ? "Aguarde…" : label}
      </button>
      <p role="alert" className="error">
        {error}
      </p>
    </div>
  );
}
