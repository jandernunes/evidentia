# Contrato de interação

O [sistema visual](DESIGN.md) define a apresentação. O plano na pasta superior define o produto; o estágio desta implementação consta no README.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | `components/forms.tsx` | Schemas Zod e este contrato | Cadastro e resposta | E2E e validação |
| Select/Listbox | `Field` native | Este contrato e DESIGN.md | Select nativo | Teclado e seleção E2E |
| Scrollbar | `globals.css` | DESIGN.md | Documento e textarea | Inspeção responsiva |
| CRUD | `ApiForm` e Route Handlers | Este contrato | Criar, consultar, editar, desativar e excluir sem dependências | E2E e isolamento |
| Formatted Work | `SubmissionForm` e `FormattedWork` | Schemas de entrega e este contrato | Markdown com prévia; texto literal legado | Segurança, teclado, axe e E2E |

| Capacidade | Responsável | Comportamento |
|---|---|---|
| Formulário e validação | `components/forms.tsx` e schemas Zod do servidor | Rótulo persistente, erro anunciado, dados preservados após falha; sem validação por popup do navegador |
| Select/listbox | `Field`, select nativo | Geometria do popup pertence ao sistema operacional; teclado nativo |
| Navegação | `Shell` e links Next | Destinos reais; sem botões decorativos |
| Criação | `ApiForm` | Atividade abre o detalhe; cadastros acadêmicos abrem a lista com confirmação |
| Feedback | `ApiForm` e painel de sessão | Inline, com região de status; erro permanece disponível |
| Scrollbar | `globals.css` | Visível em todos os elementos; document scroll |
| Listas | Página de atividades | 20 por página e paginação na URL; gestão acadêmica com busca, situação e paginação de 20 itens na URL |
| Sessão | `server/exams.ts` | Persistir antes de gerar; reenvio idêntico recupera confirmação; conflito retorna 409 |
| Ação irreversível | Encerramento docente | Consequência explícita antes do botão, em disclosure; sem exclusão de respostas |

Sessão expirada exige novo login. Não salvar texto acadêmico em armazenamento público ou cache compartilhado. Cada rota, API e consulta valida o acesso no servidor. O ambiente sem configuração apresenta a tela de acesso com explicação, sem usuários ou resultados simulados.

Testar 320, 360, 768, 1024 e 1440 px, teclado e axe-core. Validar leitor de tela manualmente antes de afirmar conformidade WCAG. Rotas e estados novos seguem este contrato.

## Gestão acadêmica

`components/management.tsx` mantém busca, paginação, região de tabela com rolagem e feedback das listas. `components/record-actions.tsx` mantém desativação e exclusão; `components/confirmation.tsx` mantém o diálogo nativo compartilhado. A confirmação abre com foco em Cancelar, mantém o foco no diálogo, fecha com Escape e devolve foco ao acionador. A tabela recebe foco para permitir rolagem por teclado em telas estreitas.

Cada tela usa a mesma autorização da API. Administrador gerencia todos os cadastros. Professor cria cursos, altera os próprios cursos, gerencia suas turmas, cadastra estudantes e altera contas que criou. Estudantes compartilhados são consultáveis pelo professor quando vinculados à sua turma; alterações de identidade e acesso ficam com a administração. Exclusão e mudança de perfil preservam vínculos acadêmicos. Edições concorrentes são recusadas com orientação para atualizar a página.

## Entregas individuais e em equipe

O texto é obrigatório. O link HTTPS do Drive é opcional e deve apontar para `drive.google.com` ou `docs.google.com`; não concede permissões no Google nem é consultado pela IA. A consulta desse link fica restrita ao docente da turma e à administração.

O autor já integra a entrega. Ao marcar equipe, deve selecionar pelo menos um colega ativo da mesma turma. Cada aluno participa de uma única entrega por atividade. O servidor verifica esses vínculos e grava a entrega com todos os integrantes em uma transação; uma seleção desatualizada retorna conflito sem criar vínculos parciais. A confirmação usa o diálogo compartilhado e preserva os campos ao cancelar ou ocorrer erro.

Todos os integrantes consultam o mesmo texto. Liberação, perguntas, respostas, revisão e resultado são individuais; os colegas não podem consultar ou responder à sessão de outro integrante. As exportações docentes apresentam um resultado por estudante, mantendo o identificador da entrega compartilhada. Entregas e sessões anteriores são preservadas pela migração. Nesta versão, o envio fixa o conteúdo e os integrantes; não há edição posterior da entrega.
