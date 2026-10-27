import { BookOpen, ClipboardList, GraduationCap, Settings, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOut } from "./sign-out";

export function Shell({
  children,
  name,
  role,
}: {
  children: ReactNode;
  name: string;
  role: string;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/atividades">
          EvidentIA<span>Avaliação da aprendizagem</span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link href="/atividades">
            <ClipboardList size={20} aria-hidden />
            Atividades
          </Link>
          {role !== "STUDENT" && (
            <Link href="/cursos">
              <BookOpen size={20} aria-hidden />
              Cursos
            </Link>
          )}
          <Link href="/turmas">
            <GraduationCap size={20} aria-hidden />
            Turmas
          </Link>
          {role !== "STUDENT" && (
            <Link href="/usuarios">
              <Users size={20} aria-hidden />
              {role === "ADMIN" ? "Usuários" : "Alunos"}
            </Link>
          )}
          <Link href="/configuracao">
            <Settings size={20} aria-hidden />
            Configuração
          </Link>
        </nav>
        <div className="identity">
          <strong>{name}</strong>
          <span>
            {role === "STUDENT" ? "Estudante" : role === "ADMIN" ? "Administração" : "Professor"}
          </span>
          <SignOut />
        </div>
      </aside>
      <main id="conteudo" className="workspace">
        {children}
      </main>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="breadcrumb">Área de aprendizagem</p>
        <h1>{title}</h1>
        {description && <p className="lead">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="empty">
      <BookOpen size={56} strokeWidth={1.5} aria-hidden />
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  );
}
export function Steps() {
  return (
    <ol className="steps">
      <li>
        <span>1</span>Preparar atividade
      </li>
      <li>
        <span>2</span>Conduzir arguição
      </li>
      <li>
        <span>3</span>Revisar evidências
      </li>
    </ol>
  );
}
export const statusLabels: Record<string, string> = {
  PENDING: "Pronta para continuar",
  PROCESSING: "Em processamento",
  WAITING: "Aguardando resposta",
  FINISHED: "Encerrada",
};
