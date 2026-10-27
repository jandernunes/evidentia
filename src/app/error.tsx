"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="conteudo" className="error-page">
      <h1>Não foi possível abrir esta página</h1>
      <p>
        Confira sua conexão e tente novamente. Se o problema continuar, procure a administração para
        verificar a configuração do serviço.
      </p>
      <button type="button" className="button" onClick={reset}>
        Tentar novamente
      </button>
      <p>
        <a href="/entrar">Voltar ao acesso</a>
      </p>
    </main>
  );
}
