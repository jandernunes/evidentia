import { redirect } from "next/navigation";
import { currentUser } from "@/server/access";
import { authConfigured } from "@/server/auth";
import { LoginForm } from "./form";
export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentUser()) redirect("/atividades");
  return (
    <main id="conteudo" className="login">
      <section className="login-intro">
        <span className="brand">
          EvidentIA<span>Avaliação da aprendizagem</span>
        </span>
        <h1>
          O que o estudante
          <br />
          consegue explicar?
        </h1>
        <p className="lead">
          Perguntas ligadas ao trabalho, evidências por objetivo e revisão do professor.
        </p>
      </section>
      <section className="login-form">
        <h2>Entre na sua conta</h2>
        <p>Use o acesso fornecido pela administração.</p>
        {!authConfigured() && (
          <p className="notice" role="status">
            A instalação aguarda a configuração do banco e da autenticação. Preencha o arquivo de
            ambiente para habilitar o acesso.
          </p>
        )}
        <LoginForm configured={authConfigured()} />
        <p className="footnote">
          Precisa de acesso ou de uma nova senha? Procure a administração da aplicação.
        </p>
      </section>
    </main>
  );
}
