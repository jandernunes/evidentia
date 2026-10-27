import Link from "next/link";
export default function NotFound() {
  return (
    <main id="conteudo" className="error-page">
      <h1>Página não encontrada</h1>
      <p>Confira o endereço ou volte para suas atividades.</p>
      <Link className="button" href="/atividades">
        Voltar às atividades
      </Link>
    </main>
  );
}
