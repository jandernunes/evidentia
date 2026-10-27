"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirmation } from "./confirmation";

export function ConfirmAction({
  endpoint,
  method = "PATCH",
  body,
  label,
  message,
  destination,
  danger = false,
}: {
  endpoint: string;
  method?: "PATCH" | "DELETE";
  body: object;
  label: string;
  message: string;
  destination?: string;
  danger?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const { confirm, confirmation } = useConfirmation();
  async function act() {
    if (pending || !(await confirm(message))) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível concluir a ação.");
      if (destination) router.push(destination);
      else setSuccess("Cadastro atualizado.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Confira a conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      {confirmation}
      <button
        className={`button ${danger ? "danger" : "secondary"}`}
        type="button"
        onClick={act}
        disabled={pending}
      >
        {pending ? "Aguarde…" : label}
      </button>
      <p className="error" role="alert">
        {error}
      </p>
      <p role="status">{success}</p>
    </div>
  );
}
export function RecordActions({
  resource,
  id,
  name,
  updatedAt,
  isActive,
  destination,
}: {
  resource: string;
  id: string;
  name: string;
  updatedAt: string;
  isActive: boolean;
  destination: string;
}) {
  return (
    <section className="panel">
      <h2>Situação do cadastro</h2>
      <p>
        Desativar preserva os vínculos e o histórico. A exclusão só é permitida quando não há
        registros dependentes.
      </p>
      <div className="inline-actions">
        <ConfirmAction
          endpoint={`/api/v1/${resource}/${id}`}
          body={{ updatedAt, isActive: !isActive }}
          label={isActive ? "Desativar cadastro" : "Reativar cadastro"}
          message={`${isActive ? "Desativar" : "Reativar"} “${name}”? ${resource === "users" ? "A desativação encerra as sessões e impede novos acessos." : "Os registros existentes serão preservados."}`}
        />
        <ConfirmAction
          endpoint={`/api/v1/${resource}/${id}`}
          method="DELETE"
          body={{ updatedAt }}
          label="Excluir cadastro"
          message={`Excluir definitivamente “${name}”? Se houver vínculos, a exclusão será recusada.`}
          destination={`${destination}?excluido=1`}
          danger
        />
      </div>
    </section>
  );
}
