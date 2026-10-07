# Guia de engenharia — Memora

Este guia é para quem vai mexer no código do protótipo. Para entender **por que** o sistema é como
é, comece por [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e pelo índice de decisões em
[`docs/adr/`](docs/adr/README.md). Para o contrato de cada rota da API, veja
[`docs/openapi.yaml`](docs/openapi.yaml). Para o estado de conformidade com o escopo, veja
[`REVISAO.md`](REVISAO.md).

## Setup

```bash
npm install
npm run dev
```

Requer Node 24 e npm 11 (funciona a partir do Node 20.19). `npm run dev` sobe os dois processos
(API mock em `:3180`, frontend em `:5180`) com saída colorida e prefixada
(`concurrently -n api,web`). Veja o `README.md` para as URLs de cada área e os atalhos de
demonstração.

Se a pasta do projeto não deixar mover/renomear/excluir, é quase sempre porque algum desses dois
processos ainda está rodando (o Node mantém um handle aberto na pasta enquanto o processo vive) —
encerre `npm run dev` (ou os processos `node` filhos, se ficaram órfãos) antes de tentar de novo.

```bash
npm test                                   # backend (vitest) + frontend (vitest)
npm run build                              # build de produção do frontend, com PWA
npm run preview -w frontend                # serve o build de produção localmente
node frontend/scripts/generate-icons.mjs   # regenera os ícones do PWA
```

## Estrutura do repositório

```
Memora/
  backend/                 API mock Express 5 — ver docs/ARCHITECTURE.md §2
    src/seed/               dados fictícios (decks, comunidade, cupons, painéis)
    src/routes/             um módulo de rota por domínio, montado em backend/src/app.js
    src/lib/                fsrs, ledger, auditoria, auth, helpers — motor de regras de negócio
    test/api.test.js        testes de regra de negócio (supertest, sem HTTP real)
    test/mcp.test.js        servidor MCP, conteúdos, blog, Recebidos e decks programados
  frontend/                 Vite 8 + React 18 + PWA — ver docs/ARCHITECTURE.md §3
    src/design-system/       componentes base compartilhados (um CSS module para todos)
    src/state/               3 contexts: Session, Study, Proto
    src/features/            uma pasta por domínio de produto (feature-first)
    src/areas/                uma pasta por área roteada (student, parental, b2b, admin, partner)
    src/i18n/pt-BR/           dicionário de strings, por domínio
    src/test/                testes de fluxo contra o backend real em processo
  docs/
    ARCHITECTURE.md          como o sistema se encaixa, com diagramas
    openapi.yaml             contrato de toda rota /v1
    adr/                     por que cada decisão foi tomada
  REVISAO.md                 auditoria de conformidade contra o escopo (achados abertos/fechados)
```

## Convenções

### Backend — adicionar uma rota

1. Escolha (ou crie) o módulo de domínio em `backend/src/routes/` — cada um exporta uma função
   `xxxRoutes()` que retorna um `express.Router()`.
2. Monte a rota em `backend/src/app.js` (`v1.use(xxxRoutes())`, ou sob um prefixo de área como
   `/admin` se for um novo painel).
3. Autenticação/autorização é sempre via `requireRole(...roles)` de `backend/src/lib/auth.js`
   (há atalhos prontos: `requireStudent`, e o próprio módulo pode declarar
   `requireRole('guardian')`, `requireRole(...ROLES.map(x => 'admin_'+x))`, etc.) — nunca leia
   `Authorization` manualmente numa rota nova.
4. Erros usam `fail(res, status, code, message, extra)` de `backend/src/lib/helpers.js` — mantém
   o formato `{ code, message, ...extra }` uniforme em toda a API. Não lance/retorne um shape de
   erro diferente.
5. Toda mutação relevante para auditoria (mudança de permissão, decisão de moderação, ação sobre
   dado pessoal) chama `appendAudit()` (`backend/src/lib/audit.js`) — veja rotas existentes para o
   padrão de `{ actor, actorRole, action, target, details }`.
6. **Atualize `docs/openapi.yaml`** com o novo path (reaproveite um `schema` de
   `components.schemas` sempre que o formato já existir) e, se a rota expressar uma decisão de
   arquitetura ou de produto (não um CRUD trivial), considere se ela merece uma ADR nova em
   `docs/adr/`.
7. Cubra a regra de negócio em `backend/test/api.test.js`.

### Frontend — adicionar uma feature

1. Crie a pasta em `frontend/src/features/<nome>/` com suas páginas/componentes e um
   `<nome>.module.css` próprio (é o padrão de todas as features existentes).
2. Toda string de interface vai para `frontend/src/i18n/pt-BR/<nome>.js` e é registrada em
   `frontend/src/i18n/pt-BR/index.js` — nenhum literal de UI direto no componente (ver
   [ADR-0006](docs/adr/0006-pt-br-unico-com-strings-externalizadas.md)). Se a string for composta
   a partir de outra chave do dicionário (recorte, `.replace()`, concatenação), crie uma chave
   própria em vez disso — recorte de string quebra ao traduzir.
3. Toda chamada de API passa pelo cliente de escopo certo em `frontend/src/lib/api.js`
   (`studentApi`/`parentalApi`/`b2bApi`/`adminApi`/`partnerApi`/`publicApi`) — nunca `fetch`
   direto num componente.
4. Estado que precisa ser lido por mais de uma feature vive num dos três contexts em
   `frontend/src/state/` (`SessionContext`, `StudyContext`, `ProtoContext`), no padrão
   Context + `useReducer` + hook `useXxx()` — não introduza uma lib de estado global para isso.
5. Componente de UI genérico (reaproveitável por mais de uma feature) vai para
   `frontend/src/design-system/`, usando `ds.module.css` — não crie um segundo design system
   paralelo dentro da feature.
6. Antes de desenhar um fluxo novo do app do aluno, confira o orçamento de toques do Mapa de Telas
   (ver [ADR-0010](docs/adr/0010-orcamento-de-toques.md)) — é mais barato desenhar dentro do
   orçamento do que refatorar depois.
7. **Sem comentário inline** em `frontend/src` nem `backend/src`
   ([ADR-0007](docs/adr/0007-sem-comentarios-de-codigo.md)). Se o "porquê" de algo não é óbvio
   pelo nome das funções/variáveis, o lugar certo para explicar é `docs/ARCHITECTURE.md` ou uma
   ADR nova — não um comentário na linha.

### Testes

Escolha o tipo certo para o que está testando (ver `docs/ARCHITECTURE.md` §3.7 para o motivo de
cada um existir separadamente):

- Regra de negócio pura do backend → `backend/test/api.test.js` (supertest sobre `createApp`).
- Fluxo de ponta a ponta do app do aluno (várias telas, backend real) →
  `frontend/src/test/*Flows*.test.jsx`, via `startLiveServer()`
  (`frontend/src/test/liveServer.js`).
- Uma área/painel isolado (Parental, B2B, Admin, Parceiro) → `frontend/src/areas/<área>/*.test.jsx`,
  com `fetch` mockado manualmente — não precisa subir servidor.
- Hook isolado (gesto, media query, etc.) → teste unitário simples com um componente de teste
  minimalista, como em `frontend/src/test/gestures.test.jsx`.

### Antes de abrir um PR

- `npm test` passando (backend + frontend).
- Se voê tocou em qualquer rota `/v1/*`: `docs/openapi.yaml` atualizado.
- Se você tomou uma decisão de arquitetura ou reverteu uma existente (e em especial se
  contradisse uma ADR listada em `docs/adr/`): registre a nova decisão ou marque a antiga como
  substituída — não deixe código e ADR divergentes.
- Se você fechou um achado do `REVISAO.md`: marque-o como resolvido na próxima rodada de revisão
  (não edite o histórico de achados já registrado, adicione uma entrada de rodada nova, como as
  rodadas 1–4 já fazem).
