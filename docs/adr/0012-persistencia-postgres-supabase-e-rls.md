# ADR-0012 — Persistência em Postgres (Supabase) com RLS e camada de dados na API

## Status

Aceita (substitui a [ADR-0001](./0001-backend-mock-em-memoria.md)).

## Contexto

A ADR-0001 mantinha todo o estado do Memora em um objeto JavaScript em memória (`store.state`) e
usava `setTimeout` (`store.later`) para simular filas assíncronas. Para o MVP real com usuários em
produção hospedado na Vercel (funções serverless efêmeras), o estado em memória é perdido a cada
invocação e timers após a resposta HTTP são congelados pelo runtime.

## Decisão

1. Adotamos o **Supabase (PostgreSQL + Storage)** como banco de dados relacional e armazenamento de
   arquivos, mantendo a **API Express como única porta de entrada** para o frontend (`/v1/*`).
2. As rotas Express não acessam o banco diretamente: toda leitura e escrita passa pela camada
   `backend/src/data/*.repo.js`, que converte o schema relacional (`snake_case`) para o contrato JSON
   existente (`camelCase`).
3. A API instancia o cliente Supabase com `SUPABASE_PUBLISHABLE_KEY` repassando o JWT do usuário
   autenticado em todas as operações de domínio, fazendo com que as políticas de **Row Level Security
   (RLS)** do Postgres atuem como segunda camada de defesa. O uso de `SUPABASE_SECRET_KEY`
   (`service_role`, exclusivo no servidor) fica restrito a pontos explícitos:
   provisionamento de cadastro via convite, gravação atômica no ledger de Neurônios via RPC,
   atualização de jobs/cotas de IA, rate limit e escrita no log de auditoria, e rotina de moderação.
4. O pipeline de geração de decks não utiliza mais `setTimeout` nem estado em memória.

## Consequências

- **A favor**: persistência real compatível com deploy serverless na Vercel; defesa em profundidade
  (autorização na API Express + RLS no Postgres); preservação integral dos contratos JSON consumidos
  pelo frontend.
- **Contra**: exige gerenciar migrations SQL versionadas (`supabase/migrations/`) e variáveis de
  ambiente; a latência de cada rota passa a incluir o round-trip até o Postgres do Supabase.

