---
version: alpha
name: EvidentIA
description: Espaço acadêmico para preparar arguições e revisar evidências de aprendizagem.
colors:
  primary: "#12645e"
  primaryHover: "#0b4d48"
  ink: "#193133"
  muted: "#516368"
  surface: "#f4f7f8"
  background: "#ffffff"
  border: "#dce5e4"
  error: "#a42626"
  success: "#17633c"
  focus: "#866000"
typography:
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
  display:
    fontFamily: "Segoe UI, Arial, sans-serif"
rounded:
  DEFAULT: "8px"
spacing:
  sectionGap: "24px"
components:
  button: {}
  field: {}
  panel: {}
---

# Sistema visual

## Contexto

Aplicação acadêmica em português do Brasil, para docentes e estudantes de qualquer curso. A tarefa principal é preparar atividades e reunir evidências que possam ser revisadas pelo docente. O navegador móvel é parte do fluxo obrigatório.

## Direção visual

Mesa de trabalho acadêmica: fundo branco, navegação cinza fria, ação em verde-petróleo e conteúdo legível. A sequência preparar, conduzir e revisar organiza o trabalho. Não usar métricas inventadas, fotos decorativas ou cartões de indicadores sem dados.

O conceito de referência está em `design/conceito.png`. A tela principal usa navegação lateral e uma região central ampla. Na largura móvel, a navegação fica acima do conteúdo, com links visíveis; essa adaptação evita um menu modal desnecessário.

## Tokens e tipografia

`src/app/globals.css` é a fonte canônica dos tokens de execução; os valores deste arquivo documentam essa escolha. Cores correspondem a `--primary`, `--primary-hover`, `--ink`, `--muted`, `--surface`, `--background`, `--border`, `--error`, `--success` e `--focus`. Raio e espaçamento usam `--radius` e `--space`. Componentes consomem esses tokens. Manter os dois arquivos coerentes quando houver mudança deliberada.

Fonte local para evitar dependência externa e mudança de layout no carregamento. Títulos têm escala fluida; controles usam tamanho explícito. Menus e formulários não dependem de hover.

## Componentes e estados

`Shell`, `PageHeading`, `Empty` e `Steps` ficam em `components/ui.tsx`. Campos e feedback em `components/forms.tsx`. Links navegam; botões executam ações. Seletores nativos preservam interação e geometria do sistema operacional. Estados de carregamento, ausência, erro e sucesso usam os mesmos componentes.

## Layout e acessibilidade

Uma coluna no celular; duas colunas de formulário apenas quando houver espaço. Conteúdo longo quebra sem ampliar a página. Rolagem pertence ao documento. Scrollbars permanecem visíveis e seguem os tokens globais. Foco, contraste, idioma, rótulos e anúncios de status são obrigatórios. Movimento respeita preferências do usuário. Cada nova tela precisa de teste automatizado e conferência manual; esse contrato não equivale a certificação de acessibilidade.

## Texto

Aplicar humanizer a rótulos, instruções, erros e perguntas. Relatórios do app estão dispensados. Preservar respostas de estudantes e transcrições sem reescrita.

## Gestão de cadastros

Listas de cursos, turmas e usuários compartilham busca, filtro de situação, paginação e tabela com cabeçalho e legenda. No celular, a busca ocupa uma coluna; a rolagem horizontal fica na região nomeada da tabela, com acesso por teclado. Formulários reutilizam `ApiForm` e `Field`. O diálogo de confirmação e as ações de situação são compartilhados entre entidades, sem dependências novas.

## Entrega do trabalho

`SubmissionForm` usa o formulário compartilhado e oferece botões de formatação Markdown, atalhos de negrito e itálico e uma prévia abaixo do campo. O texto continua obrigatório, entre 50 e 20.000 caracteres, e fica disponível para correção após erros. `FormattedWork` apresenta a mesma formatação na prévia e na consulta, sem executar HTML ou carregar imagens externas. Entregas antigas mantêm sua apresentação literal.

A seleção de colegas usa checkboxes nativos. A confirmação de envio informa que o texto será compartilhado com os integrantes. Cada estudante acessa apenas sua própria arguição. O link opcional do Drive fica disponível ao professor responsável e à administração, sem consulta automática pela IA. Barra de formatação e ações quebram em várias linhas no celular.
