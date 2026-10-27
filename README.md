# EvidentIA

Aplicação Next.js com TypeScript, PostgreSQL, Prisma e autenticação Better Auth. O código fica nesta pasta; os documentos de inscrição serão preparados depois.

## Etapa implementada

- Login local, cadastro de contas pela administração e cadastro público bloqueado.
- Cursos e disciplinas configuráveis, turmas compartilhadas e associação de estudantes por CSV.
- Atividades com objetivos e critérios próprios de qualquer área.
- Entrega textual, liberação docente, sessão com uma pergunta por vez e transcrição identificada.
- Resposta gravada antes da próxima geração, reenvio idempotente, reserva com vencimento e rejeição de retorno atrasado.
- Mapa provisório, revisão docente com histórico e liberação do resultado ao estudante.
- Exportações CSV e JSON por atividade, com autorização docente e indicação de revisão pendente.
- Telas adaptáveis, navegação por teclado, rótulos e anúncios de status; a conformidade integral de acessibilidade ainda depende de avaliação.

O provedor inicial implementado é OpenAI Responses, chamado somente no servidor. Sem chave e modelo preenchidos, o app informa que a IA está indisponível e preserva os registros. Não há geração simulada para substituir a API.

## Ambiente

O arquivo `.env` foi criado com credenciais vazias para preenchimento local e está ignorado pelo Git. `.env.example` contém os mesmos nomes e exemplos sem segredo.

Preencha `DATABASE_URL`, `BETTER_AUTH_SECRET` (aleatória, pelo menos 32 caracteres), `BETTER_AUTH_URL` e `APP_BASE_URL`. Para IA, preencha `OPENAI_API_KEY` e `LLM_MODEL` com um modelo acessível à sua conta e compatível com Responses e saída JSON. Não há um modelo escolhido automaticamente. Não use prefixo `NEXT_PUBLIC_` em segredos.

O compose inicia somente o PostgreSQL de desenvolvimento. A porta local é definida por `POSTGRES_PORT` (padrão `5433`); `DATABASE_URL` deve usar a mesma porta, usuário, senha e banco do `.env`. Os dados permanecem no volume. Não exponha essa porta na VPS.

Em 19/10/2026, o banco local `evidentia_dev` foi criado no projeto Compose `evidentia-dev`, com usuário `evidentia`, endereço `127.0.0.1:15433` e senha aleatória salva somente no `.env` ignorado. A porta `5433` já estava ocupada. As duas migrações existentes foram aplicadas; o banco de testes permanece separado. O container dev deve ficar em execução para usar a aplicação.

```sh
npm ci
docker compose up -d
npm run db:generate
npm run db:migrate
```

Para criar o primeiro administrador, preencha as variáveis `ACCOUNT_NAME`, `ACCOUNT_EMAIL`, `ACCOUNT_PASSWORD` e `ACCOUNT_ROLE` (`ADMIN` para o primeiro acesso; o comando também aceita `TEACHER` ou `STUDENT`), execute o comando abaixo e remova a senha do arquivo após o uso. Não há credencial padrão.

```sh
npm run account:create
npm run dev
```

Abra `http://localhost:3000`. A administração usa **Usuários → Cadastrar usuário** para criar administradores, professores e estudantes. Informe nome, e-mail, perfil e senha inicial com pelo menos 8 caracteres. A senha não é enviada por e-mail; compartilhe-a diretamente com a pessoa. Não há cadastro público.

O professor usa **Alunos → Cadastrar aluno** para criar estudantes e pode informar turma e matrícula no mesmo cadastro. Contas já existentes podem ser vinculadas no detalhe da turma, por e-mail e matrícula ou por CSV com cabeçalho `matricula,nome,email`. A importação não cria contas nem redefine senhas.

**Cursos**, **Turmas** e **Usuários/Alunos** oferecem busca, paginação, edição, desativação e exclusão sem dependências. Administradores gerenciam todos os cadastros e atribuem responsáveis às turmas. Professores criam cursos, gerenciam os cursos que criaram e suas próprias turmas, e alteram alunos que cadastraram. Alunos cadastrados por outra pessoa e vinculados à turma podem ser consultados; a administração altera sua identidade e acesso.

Desativar uma conta encerra suas sessões e bloqueia novos acessos. Mudar e-mail, senha ou perfil também encerra sessões. A própria conta não pode ser desativada, excluída ou ter seu perfil alterado por si mesma. Vínculos acadêmicos bloqueiam exclusão e mudança de perfil. Cursos e turmas desativados preservam o histórico; novos vínculos exigem cadastro ativo.

## Verificações

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes de navegador usam uma base sintética separada, `.env.test` ignorado e dados produzidos por `scripts/prepare-test.ts`. Nunca aponte esses testes para um banco de uso real. A rotina exige nome de banco `evidentia_test`. O Playwright usa a porta 3100, artefatos em `.next-test`, origem de autenticação própria e chave de IA vazia. O script `scripts/test-server.mjs` compila e inicia uma versão de produção isolada; os testes não reutilizam o servidor de desenvolvimento.

## Easypanel

Dockerfile com saída standalone, porta 3000 e usuário sem privilégios. Configure PostgreSQL privado e as variáveis no painel. Migrações são executadas uma vez por release usando o alvo `migrate` do Dockerfile, com a mesma conexão de banco, antes de iniciar o serviço web. O alvo final é `runner`. O arquivo `.env` nunca entra na imagem. Teste backup e restauração antes de usar dados reais. A primeira implantação foi conferida em 27/10/2026, conforme o registro ao final deste arquivo.

Quando o painel não permite selecionar o alvo de build, `Dockerfile.admin` fornece uma imagem administrativa separada com Prisma e os scripts de cadastro. Ela usa `DATABASE_URL` em tempo de execução e executa `npm run db:migrate` por padrão. Use-a somente para administração; o serviço web deve continuar com `Dockerfile`. As credenciais administrativas de um PostgreSQL compartilhado não devem permanecer no ambiente do serviço web.

## Limites desta etapa

Entrada PDF, relatório PDF, prazo de entrega, edição/versionamento de atividades pela interface, primeiro acesso com troca obrigatória de senha, recuperação de conta pela interface, auditoria operacional completa e métricas de custo/modelo ainda estão pendentes. A importação associa contas existentes; não provisiona novas contas. As telas de gestão usam paginação de 20 itens. As APIs de listagem legadas mantêm limites de 200 itens para catálogos/usuários e 100 para turmas. Não usar esta versão com dados acadêmicos reais antes de concluir esses controles e a validação do piloto.

Textos de interface foram revisados com humanizer; perguntas incluem suas orientações no prompt. Relatórios do app estão dispensados. Consulte `DESIGN.md` e `UX-CONTRACT.md` para os critérios de interface.

As sessões têm limite de 12 tentativas de geração. Esse limite é uma proteção operacional; não representa um orçamento monetário. Os testes de integração usam `npm run test:integration` e não consultam o provedor.

## Verificação desta etapa

Em 14/10/2026: TypeScript e lint aprovados; 18 testes de contrato e seis testes transacionais com PostgreSQL aprovados. O fluxo Playwright passou por cadastro, turma, importação, atividade, entrega, liberação, resposta, retomada, encerramento, revisão e exportações. IA foi simulada somente nos testes de integração; o teste de navegador confirmou a mensagem de integração não configurada.

O teste verificou isolamento entre contas e exportações, cinco larguras na lista e larguras de 320 e 1440 px nas demais telas implementadas. Axe-core não encontrou violações nos critérios automatizados executados. Isso não substitui testes com leitor de tela e dispositivos reais.

O plugin Browser não está disponível nesta sessão; a validação usou Playwright Chromium. As capturas e o conceito `design/conceito.png` foram inspecionados com `view_image`. Foram conferidos fundo branco, cor de ação, tipografia, espaçamento, navegação e disposição móvel. O conteúdo inicial preserva título, instruções e ações do conceito. Ajustes deliberados: identificação da área neutra para diferentes perfis, links móveis visíveis em vez de menu recolhido, ícones Lucide e identificação da conta real de teste. A captura desktop foi refeita depois de aguardar o conteúdo, pois a primeira ainda mostrava carregamento.

Docker de produção compilado e iniciado localmente sem segredos. O smoke verificou healthcheck, acesso, CSS, rejeição de API sem autenticação e execução sem usuário root. Auditoria npm sem vulnerabilidades reportadas na execução. A auditoria estática de interface terminou sem achados bloqueadores; o lint de DESIGN.md não teve erros e sinalizou referências de tokens documentadas sem vínculo no frontmatter de componentes.

Não houve teste com chave/modelo reais, publicação no GitHub ou implantação na VPS. Entrada e relatório PDF, fluxos completos de conta e demais limites acima continuam pendentes. A documentação de inscrição permanece adiada.

## Gestão acadêmica validada em 26/10/2026

As telas de Cursos, Turmas e Usuários/Alunos incluem listagem com busca e paginação, cadastro, edição, situação e exclusão protegida por vínculos. A migração `202610260001_management` foi aplicada ao banco de desenvolvimento sem remover dados.

Passaram lint, TypeScript, compilação de produção, 18 testes de contrato e 13 testes de integração com PostgreSQL. O fluxo acadêmico e o fluxo de gestão passaram no Playwright Chromium, em servidor de produção e banco sintético separados. Foram verificados os três perfis, restrições do professor, identidade compartilhada, desativação e revogação de sessões, matrículas, bloqueio de exclusão com histórico, foco e cancelamento de confirmação, larguras de 320 e 1440 px nas nove telas novas e axe-core sem violações nas regras executadas. O fluxo de atividades também mantém sua verificação de cinco larguras.

O plugin Browser não está disponível nesta sessão; a verificação usou Playwright instalado no projeto. As capturas são temporárias, fora do repositório. A tela local de acesso foi conferida em `http://localhost:3000`, com JavaScript pronto e envio POST; a API de usuários respondeu 401 sem autenticação. Não houve chamada real de IA, envio de credenciais por e-mail, publicação no GitHub ou implantação na VPS nesta etapa. Leitor de tela e dispositivos físicos continuam sem validação manual.

O formulário local de cadastro de aluno também foi inspecionado visualmente em 1440 e 360 px, após aguardar a hidratação. Campos, navegação, instruções e ações ficaram legíveis, sem rolagem horizontal da página e sem erros de console. As primeiras capturas ainda exibiam o carregamento e foram descartadas da conferência visual.

## Implantação no Easypanel em 27/10/2026

Serviço `ai_agents/evidentia`, com domínio HTTPS `https://ai-agents-evidentia.gllv1i.easypanel.host`. O banco lógico `evidentia` usa o PostgreSQL existente `ai_agents/postgres_dev`, com usuário próprio `evidentia_app`. As três migrações foram aplicadas e conferidas no banco de destino. O PostgreSQL compartilhado não foi reiniciado.

A preparação usou temporariamente a imagem administrativa, mediante autorização do responsável. Ao concluir, foram removidos do app a credencial administrativa do PostgreSQL, o script temporário e seu comando de execução. O serviço voltou ao `Dockerfile` web, executando `node server.js`, com apenas a conexão do usuário próprio do banco. Os valores das credenciais não são versionados.

O smoke por HTTPS confirmou healthcheck e tela de acesso com status 200, arquivo estático com status 200, API de usuários com 401 sem autenticação e tentativa sintética de acesso com 401 por credenciais inexistentes. A tela deixou de indicar configuração de banco pendente. Não foi criada uma conta administrativa de produção nem houve importação de dados locais. Chamadas reais de IA e backup/restauração ainda não foram validados nesta implantação.
