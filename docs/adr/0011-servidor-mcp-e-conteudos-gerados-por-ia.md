# ADR-0011 — Servidor MCP e conteúdos gerados por IA na comunidade

## Status

Aceita.

## Contexto

O Memora passa a se posicionar como comunidade de estudos com quatro tipos de conteúdo gerados
por IA: flashcards (decks), resumos, mapas mentais e notícias/posts de blog. Esse material nasce
em conversas com assistentes de IA de terceiros (Claude, ChatGPT, Cursor…) e em provedores de
conteúdo educacional. O protocolo MCP (Model Context Protocol) é o ponto que liga essas fontes ao
Memora.

## Decisão

- **Servidor MCP próprio, sem SDK**, em `POST /v1/mcp` (`backend/src/routes/mcp.js`).
  Transporte Streamable HTTP só com respostas JSON (sem stream SSE): `initialize`, `ping`,
  `tools/list`, `tools/call`, notificações respondidas com 202. As versões de protocolo aceitas
  ficam em `MCP_PROTOCOL_VERSIONS`. `GET`/`DELETE /v1/mcp` devolvem 405.
- **Autenticação por token de conexão** (`mcp_<random>`), criado pelo aluno em
  Comunidade › Conectar IA (`POST /v1/mcp/connections`). O token aparece uma vez só; o estado
  guarda apenas `sha256(token)` e os 4 últimos caracteres. A conexão pode ser revogada a qualquer
  momento. O token só alcança as ferramentas MCP, nunca a API do app.
- **Ferramentas** (`backend/src/lib/mcpTools.js`):
  - Escrita: `salvar_flashcards`, `salvar_resumo`, `salvar_mapa_mental`, `salvar_noticia`.
  - Leitura: `buscar_comunidade`, `ler_conteudo`, `meus_conteudos`, `listar_categorias`.
  - Limite de 50 escritas por dia por aluno.
  - Erro de entrada volta como `isError: true`, e a conexão segue aberta.
- **Tudo nasce privado.** `publicar: true` reaproveita as mesmas pré-condições da publicação de
  deck (`backend/src/lib/publishing.js`): conta ativa, e-mail e telefone verificados, liberação
  do responsável e aceite da política. Se alguma faltar, o conteúdo fica guardado e privado, e a
  ferramenta explica o motivo. A política nunca é aceita pela IA; o aceite é sempre do aluno, no
  app.
- **Moderação única.** Resumos, mapas e notícias entram na mesma fila `state.publications` com
  `kind: 'material'`. O `snapshot` é convertido em blocos frente/verso para o moderador ler, e
  `POST /admin/moderation/:id/decide` publica ou rejeita o material.
- **Modelo de dados.** `state.materials` guarda os materiais com:
  - `kind`: resumo, mapa ou noticia
  - `body` específico do tipo: Markdown + fontes; árvore `root`; Markdown + `url` + veículo
  - `status`: privado, em_triagem, aprovado ou rejeitado
  - `source`: qual conexão MCP criou o material

  Flashcards continuam sendo decks em `state.decks`/`state.cards`.

- **Onde o MCP aparece no app** (revisado em 2026-10-07):
  - **Perfil › Conexões** (`/app/perfil/conexoes`): configuração de tokens, ferramentas e atividade. O acesso é pelo card do usuário na barra lateral, no estilo do Claude.
  - **Criar deck**, como a origem "Vindos de outros sistemas".
  - **Nunca na Comunidade.** A Nôa (`/app/noa`) é a área de IA da casa e não mistura MCP.
- **Solicitações via MCP** (revisado em 2026-10-07):
  - Tudo o que uma IA salva chega com `mcpReview: 'pendente'` e aparece só em **Recebidos (MCP)** (`/app/recebidos`). Não aparece em Meu blog, Meus decks nem na comunidade.
  - O aluno **aprova**, escolhendo o destino:
    - comunidade, com aceite da política e moderação;
    - só seguidores;
    - só Meu blog.
    Decks aprovados entram no estudo.
  - Ou o aluno **recusa**, e o conteúdo é excluído.
  - A IA não tem mais como publicar diretamente: o argumento `publicar` foi removido das ferramentas.
- **Decks programados.** Cada deck tem `scheduled`. O plano do dia (`todaySession`) usa só os decks programados, e o aluno escolhe quais são na aba Decks. Decks sem o campo contam como programados.

## Consequências

- **A favor**: qualquer cliente MCP se conecta só com URL + header, sem dependência nova no
  backend. Conteúdo de IA não entra na comunidade sem moderação humana nem sem o consentimento do
  aluno. Os provedores de conteúdo usam o mesmo contrato.
- **Contra**: herda o ADR-0001, ou seja, tudo é perdido ao reiniciar o processo. Não há OAuth
  (exigido por alguns clientes MCP remotos); o token vai no header `Authorization`. Sem SSE, não
  há notificações do servidor para o cliente.

## Atualização de 2026-11-09

O contexto e a decisão acima continuam valendo. Esta seção registra o que mudou desde então.

- **Seis tipos de conteúdo.** Além de flashcards, resumos, mapas mentais e posts de blog, o
  Memora aceita `quiz` (múltipla escolha) e `linha` (linha do tempo). `state.materials` passa a
  ter `kind` em `resumo`, `mapa`, `noticia`, `quiz` ou `linha`, com `body` próprio:
  - `quiz`: `questions[]` com `id`, `prompt`, `options` (2 a 5), `answer` (índice da correta) e
    `explanation` opcional; até 40 questões.
  - `linha`: `events[]` com `id`, `when`, `label` e `note` opcional; de 2 a 60 marcos.
- **Ferramentas de escrita** passam a ser seis: `salvar_flashcards`, `salvar_resumo`,
  `salvar_mapa_mental`, `salvar_quiz`, `salvar_linha_do_tempo` e `salvar_noticia`. As de leitura
  não mudam. Quiz e linha do tempo seguem o mesmo caminho dos outros materiais: chegam pendentes
  em Recebidos e só vão para a comunidade com aprovação do aluno e moderação.
- **Mapa mental em diagrama.** `salvar_mapa_mental` aceita `layout: 'mapa' | 'diagrama'`
  (padrão `mapa`), guardado em `body.layout`. O diagrama mostra a mesma árvore como etapas de um
  fluxo ou processo.
- **Remix com crédito.** Toda ferramenta de escrita aceita `remix_de`, o id de um deck ou material
  da comunidade usado como base. O servidor só grava `remixOf` (`id`, `kind`, `title`,
  `authorId`, `authorName`) se o original existir e for visível ao aluno. O conteúdo novo mostra o
  crédito, e o original lista os remixes aprovados (`remixes`, `remixCount`).
- **Tentativas de quiz.** O servidor corrige e guarda as tentativas em
  `state.community.quizAttempts` (`POST /community/materials/:id/quiz-attempts`). O detalhe do
  material traz `viewer.quiz` com a melhor nota, o total de tentativas e a última. As questões
  erradas da última tentativa viram um deck "Revisão: <título>" já programado
  (`POST /community/materials/:id/quiz-review`). Esse deck nasce no app, por ação do aluno, então
  não passa por Recebidos.
- **Grupos de estudo.** `state.community.groups` reúne alunos por prova ou tema. O grupo não tem
  conteúdo próprio: mostra os decks e materiais publicados que combinam com sua categoria ou suas
  tags (`backend/src/lib/groups.js`), com ranking de criadores, meta semanal coletiva e um mural.
  Postar no mural exige ser membro, ter conta verificada e, para menores, a liberação do
  responsável. Conteúdo vindo de IA só aparece num grupo depois de aprovado e publicado.
