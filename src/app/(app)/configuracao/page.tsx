import { PageHeading } from "@/components/ui";
import { pageUser } from "@/server/access";
export const metadata = { title: "Configuração" };
export default async function SettingsPage() {
  const user = await pageUser();
  return (
    <>
      <PageHeading title="Configuração" description="Acompanhe o preparo da aplicação para uso." />
      <section className="panel">
        <h2>Sua conta</h2>
        <p>
          {user.name}
          <br />
          {user.email}
        </p>
        <p>Alterações de acesso são realizadas pela administração.</p>
      </section>
      {user.role === "ADMIN" && (
        <section className="panel">
          <h2>Integração de IA</h2>
          <p>
            {process.env.OPENAI_API_KEY && process.env.LLM_MODEL
              ? "Chave e modelo informados. A integração ainda precisa de teste com o provedor."
              : "Aguardando o preenchimento da chave e do modelo no ambiente do servidor."}
          </p>
          <p className="hint">As credenciais nunca são exibidas aqui.</p>
        </section>
      )}
      <section className="panel">
        <h2>Sobre esta versão</h2>
        <p>
          Primeira etapa de implementação: atividades com entrega textual e microarguição. A
          importação vincula contas previamente criadas. PDF de entrada, relatórios e recuperação de
          senha pela interface ainda não estão disponíveis.
        </p>
        <p>A revisão docente continua necessária antes de liberar uma conclusão ao estudante.</p>
      </section>
    </>
  );
}
