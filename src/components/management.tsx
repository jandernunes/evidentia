import Link from "next/link";
import { Field } from "./forms";

export type ListParams = {
  q?: string;
  status?: string;
  pagina?: string;
  salvo?: string;
  excluido?: string;
};
export function listState(params: ListParams) {
  return {
    q: (typeof params.q === "string" ? params.q : "").trim().slice(0, 160),
    status: ["active", "inactive"].includes(params.status ?? "") ? (params.status ?? "all") : "all",
    page: Math.max(1, Math.min(100000, Math.floor(Number(params.pagina) || 1))),
  };
}
export function activeFilter(status: string) {
  return status === "all" ? {} : { isActive: status === "active" };
}
export function SearchToolbar({ q, status, label }: { q: string; status: string; label: string }) {
  return (
    <form method="get" noValidate className="search-toolbar">
      <Field name="q" label={label} defaultValue={q} required={false} />
      <Field name="status" label="Situação" defaultValue={status}>
        <option value="all">Todos</option>
        <option value="active">Ativos</option>
        <option value="inactive">Desativados</option>
      </Field>
      <button className="button secondary" type="submit">
        Buscar
      </button>
    </form>
  );
}
export function Pagination({
  page,
  total,
  base,
  q,
  status,
}: {
  page: number;
  total: number;
  base: string;
  q: string;
  status: string;
}) {
  const url = (p: number) => `${base}?${new URLSearchParams({ q, status, pagina: String(p) })}`;
  return (
    <nav className="pagination" aria-label="Paginação dos cadastros">
      {page > 1 && <Link href={url(page - 1)}>Anterior</Link>}
      <span>
        Página {page} de {Math.max(1, Math.ceil(total / 20))} · {total} registros
      </span>
      {page * 20 < total && <Link href={url(page + 1)}>Próxima</Link>}
    </nav>
  );
}
export function SavedNotice({ params }: { params: ListParams }) {
  return params.salvo || params.excluido ? (
    <p role="status" className="notice">
      {params.excluido ? "Cadastro excluído." : "Cadastro salvo."}
    </p>
  ) : null;
}
export function ActiveLabel({ active }: { active: boolean }) {
  return (
    <span className={active ? "state-active" : "state-inactive"}>
      {active ? "Ativo" : "Desativado"}
    </span>
  );
}

export function TableRegion({
  label,
  children,
}: {
  label: string;
  children: import("react").ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: A tabela com rolagem horizontal precisa receber foco para uso das setas.
    <section className="table-region" tabIndex={0} aria-label={label}>
      {children}
    </section>
  );
}
