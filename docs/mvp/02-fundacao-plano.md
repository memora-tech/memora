# Plano de Fundação do MVP Real — Memora

**Data:** 12/11/2026  
**Branch de trabalho:** `mvp-v1`  
**Prazo do MVP:** 14/11/2026  
**Público-alvo:** ~5 testadores adultos (≥ 18 anos)  
**Escopo:** App do aluno (Estudo FSRS, Decks/Pastas/Cards, Objetivos, Geração de Decks, Comunidade de Decks com Moderação Leve, Nôa, Carteira/Ledger de Neurônios e Perfil/Privacidade).

---

## 0. Resumo Arquitetural e Lista de Arquivos (Criar / Alterar)

### 0.1 Fluxo de Arquitetura
```
[Frontend React/Vite (Vercel Static)]
   │  1a. Cadastro: POST /v1/auth/register (com inviteCode + birthDate; signup público do Supabase DESLIGADO)
   │  1b. Login / Recuperação: signInWithPassword / resetPasswordForEmail (ou via /v1/auth/*)
   ▼
[Supabase Auth] ──► Emite JWT (access_token + refresh_token)
   │
   │  2. Chamadas HTTP para /v1/* (mesma origem via Vercel Rewrite)
   │     Header: Authorization: Bearer <JWT>
   ▼
[API Express 5 (Vercel Function: api/index.js)]
   │  3. Hardening: Security Headers, CORS restrito, JSON limit (100kb) e Rate Limit (Postgres RPC)
   │  4. Middleware requireStudent valida JWT no Supabase Auth e carrega perfil (≥ 18 anos)
   │  5. Rotas chamam a camada de dados (backend/src/data/*.repo.js)
   ├─────────────────────────────────────────────────────────────────┐
   │ Regra geral: Cliente Supabase com JWT do usuário (RLS ativa)    │ Exceções explícitas: Cliente service_role
   ▼                                                                 ▼
[Supabase Postgres (RLS = 2ª camada) + Supabase Storage]    [Cadastro Admin / Ledger / Cotas & IA / Rate Limit / Audit / Moderação]
```

### 0.2 Pontos Explícitos e Exclusivos de Uso da `service_role`
A chave `SUPABASE_SERVICE_ROLE_KEY` **jamais** existe no frontend e, no backend, é encapsulada exclusivamente em `backend/src/data/supabase.js` (`createServiceClient()`), sendo chamada apenas em **5 pontos**:
1. **Cadastro de Usuário no Servidor (`backend/src/routes/auth.js` + `backend/src/data/profiles.repo.js`):** como o signup público do Supabase Auth fica desligado, apenas `POST /v1/auth/register` (após validar o `INVITE_CODE` e idade ≥ 18 anos) chama `auth.admin.createUser({ email, password, email_confirm: true })` e provisiona o perfil inicial.
2. **Ledger de Neurônios (`backend/src/data/ledger.repo.js`):** invocação da função RPC `public.append_neuron_ledger_entry` para creditar/debitar Neurônios de forma atômica, já que os usuários autenticados têm apenas permissão de `SELECT` em `neuron_ledger`.
3. **Jobs de IA e Tabelas de Cota/Orçamento (`backend/src/data/generation.repo.js` e `backend/src/data/noa.repo.js`):** escrita em `generation_daily_usage` e `noa_daily_budget` (que não aceitam `INSERT`/`UPDATE` via `authenticated`), gravação do resultado processado pelo Gemini Flash e estorno de cota em caso de falha.
4. **Rate Limit e Auditoria Mínima (`backend/src/lib/rateLimit.js` e `backend/src/data/audit.repo.js`):** invocação das RPCs `public.check_rate_limit` (contador atômico em `public.rate_limits`) e `public.append_audit_entry` (inserção encadeada em `public.audit_log`).
5. **Rotina de Moderação (`backend/src/data/community.repo.js`):** ocultação administrativa de conteúdo (`hidden_at`) quando acionada pelo sistema.

### 0.3 Lista Completa de Arquivos a Criar e Alterar

#### Arquivos a CRIAR:
- `.env.example` — template de variáveis de ambiente (apenas nomes, sem valores).
- `vercel.json` — configuração de build do frontend e rewrite de `/v1/(.*)` para a função serverless da API.
- `api/index.js` — entrypoint serverless da Vercel exportando o `createApp()` do backend.
- `supabase/migrations/20261112000100_extensions_and_helpers.sql` — extensões (`pgcrypto`), função `set_updated_at()` e helper de cálculo de maioridade.
- `supabase/migrations/20261112000200_profiles_and_consents.sql` — tabelas `profiles` (com trigger `protect_profile_columns`), `user_consents`, `study_settings` e `objectives`.
- `supabase/migrations/20261112000300_decks_cards_reviews.sql` — tabelas `folders`, `decks`, `cards` (com colunas FSRS) e `reviews`.
- `supabase/migrations/20261112000400_generation_and_noa.sql` — tabelas `generation_daily_usage`, `generation_jobs`, `noa_daily_budget`, `noa_suggestions`, `noa_decisions` e `noa_chat_messages`.
- `supabase/migrations/20261112000500_community_and_moderation.sql` — tabelas `deck_publications`, `deck_comments`, `comment_likes`, `deck_reactions`, `deck_favorites`, `deck_votes`, `author_follows`, `moderation_reports`, view `v_moderation_queue` e função `moderate_hide_target`.
- `supabase/migrations/20261112000600_ledger_and_audit.sql` — tabelas `neuron_ledger`, `audit_log` e `rate_limits`, triggers de imutabilidade (bloqueio de `UPDATE`/`DELETE`) e funções RPC `append_neuron_ledger_entry`, `append_audit_entry` e `check_rate_limit`.
- `supabase/migrations/20261112000700_rls_policies.sql` — ativação de RLS (`ENABLE` + `FORCE`) e políticas tabela por tabela (incluindo bloqueio de escrita direta em `generation_daily_usage` e `noa_daily_budget`).
- `supabase/migrations/20261112000800_storage_buckets.sql` — criação dos buckets `card-media` e `generation-uploads` e políticas de Storage.
- `supabase/full_migration.sql` — script consolidado para execução manual única no SQL Editor do Supabase.
- `backend/src/config/features.js` — flags de escopo do MVP no servidor.
- `backend/src/lib/security.js` — middlewares nativos de cabeçalhos de segurança e validação de origem CORS restrita.
- `backend/src/lib/rateLimit.js` — middleware de rate limit compatível com serverless (via RPC `check_rate_limit` no Postgres, com fallback em memória apenas nos testes unitários sem banco).
- `backend/src/lib/gemini.js` — cliente HTTP para a API Google Gemini Flash (geração de cards por texto, tema e PDF até 50 páginas + chat da Nôa).
- `backend/src/data/supabase.js` — fábrica de clientes Supabase (`createUserClient(jwt)` e `createServiceClient()`).
- `backend/src/data/mappers.js` — conversão entre linhas `snake_case` do Postgres e os contratos JSON `camelCase` da API.
- `backend/src/data/profiles.repo.js` — acesso a dados de `profiles` e `user_consents`.
- `backend/src/data/decks.repo.js` — acesso a dados de `decks`, `cards` e `folders`.
- `backend/src/data/study.repo.js` — acesso a dados de `study_settings`, `reviews` e `objectives`.
- `backend/src/data/generation.repo.js` — acesso a dados de `generation_jobs` e `generation_daily_usage`.
- `backend/src/data/community.repo.js` — acesso a dados de `deck_publications`, `deck_comments`, `comment_likes`, `deck_reactions`, `deck_favorites`, `deck_votes`, `author_follows` e `moderation_reports`.
- `backend/src/data/noa.repo.js` — acesso a dados de `noa_daily_budget`, `noa_suggestions`, `noa_decisions` e `noa_chat_messages`.
- `backend/src/data/ledger.repo.js` — acesso ao `neuron_ledger` e chamada à RPC atômica.
- `backend/src/data/audit.repo.js` — acesso ao `audit_log`.
- `backend/src/data/index.js` — agregador dos repositórios injetado em `req.data`.
- `frontend/src/config/features.js` — flags de escopo do MVP no frontend.
- `frontend/src/lib/supabase.js` — cliente `@supabase/supabase-js` no navegador para Auth e upload ao Storage.
- `docs/adr/0012-persistencia-postgres-supabase-e-rls.md` — nova ADR substituindo a ADR-0001.
- `docs/adr/0013-autenticacao-supabase-auth-jwt-adultos.md` — nova ADR substituindo a ADR-0008.

#### Arquivos a ALTERAR:
- `.gitignore` — inclusão de `.env`, `.env.*`, `!.env.example` e `.vercel/`.
- `package.json`, `backend/package.json`, `frontend/package.json` — adição de `@supabase/supabase-js` e scripts de verificação.
- `docs/adr/0001-backend-mock-em-memoria.md` — atualização do status para *Substituída por ADR-0012*.
- `docs/adr/0008-autenticacao-por-sessao-simples.md` — atualização do status para *Substituída por ADR-0013*.
- `docs/adr/README.md` — inclusão das ADRs 0012 e 0013 na tabela de índice.
- `backend/src/app.js` — desligamento por flag das rotas fora do MVP (`/parental`, `/b2b`, `/admin`, `/partner`, `/_proto`, `/mcp`, `/materials`, `/subscription`), injeção de `req.data`.
- `backend/src/lib/auth.js` — validação real do JWT do Supabase em `requireRole`/`requireStudent`, instanciando `req.db = createUserClient(token)` e carregando o perfil de `public.profiles`.
- `backend/src/lib/helpers.js` — remoção da exigência de verificação de telefone em `requireVerified` e `publicUser` (mantendo apenas e-mail confirmado e idade ≥ 18).
- `backend/src/lib/publishing.js` — ajuste da publicação de deck para nascer com `status = 'aprovado'` e `hidden_at = null` (moderação leve).
- `backend/src/routes/auth.js` — migração para Supabase Auth, validação de idade ≥ 18 no servidor, remoção de código fixo `123456` e de login sem senha.
- `backend/src/routes/me.js` — migração para `profiles.repo` e `ledger.repo`, desligamento por flag de `/me/guardian-requests`.
- `backend/src/routes/decks.js` — migração para `decks.repo` e `community.repo`, desligamento por flag de `/folders/:id/members` e `/publications/:id/appeal`.
- `backend/src/routes/study.js` — migração para `study.repo` e `ledger.repo`.
- `backend/src/routes/generation.js` — remoção de `startTimeline`/`store.later` (`setTimeout`), execução síncrona compatível com Vercel Serverless e persistência via `generation.repo`.
- `backend/src/routes/community.js` — migração das rotas de decks da comunidade para `community.repo` (respeitando `hidden_at IS NULL`), desligamento por flag de grupos (`/community/groups*`) e rankings (`/community/rankings`).
- `backend/src/routes/wallet.js` — migração de `GET /wallet` para `ledger.repo`, desligamento por flag das rotas de cupons (`/coupons*`, `/wallet/coupons*`).
- `backend/src/routes/noa.js` — migração para `noa.repo` e inclusão de suporte a mensagens de chat (`noa_chat_messages`).
- `backend/src/routes/privacy.js` — migração de `/privacy/policy`, `/privacy/decisions`, `/privacy/delete` e `/privacy/reactivate` para os repositórios reais.
- `backend/src/routes/public.js` — migração de `/public/decks/:publicId` e `/public/content-policy` respeitando `hidden_at IS NULL`.
- `frontend/src/app/App.jsx` — remoção de `<ProtoBar />` e proteção das rotas fora do MVP via `FEATURES`.
- `frontend/src/state/ProtoContext.jsx` — desativação das chamadas `/_proto/*` quando `!FEATURES.protoBar`.
- `frontend/src/state/SessionContext.jsx` — integração com `supabase.auth` (`signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`) enviando o JWT para `studentApi`.
- `frontend/src/features/auth/LoginPage.jsx` — remoção dos botões de atalho demo/federado mockado.
- `frontend/src/features/auth/RegisterPage.jsx` — inclusão do campo de senha, validação de ≥ 18 anos e remoção de telefone obrigatório se aplicável.
- `frontend/src/features/auth/ConfirmPage.jsx` — remoção da verificação de telefone e da dica do código `123456`, adaptando ao fluxo real de confirmação de e-mail do Supabase.
- `frontend/src/features/auth/RecoverPage.jsx` — integração com `resetPasswordForEmail` e tela de redefinição de nova senha.
- `frontend/src/areas/student/StudentLayout.jsx`, `UserMenu.jsx`, `ProfileHome.jsx`, `CommunityHome.jsx`, `WalletPage.jsx`, `NoaHub.jsx`, `CreatePage.jsx`, `DeckDetail.jsx` — ocultação condicional por flag dos itens fora do MVP (MCP, Recebidos, Materiais/Blog, Grupos, Ranking, Assinatura, Cupons, Compartilhamento de Pasta).
- `frontend/src/i18n/pt-BR/auth.js` — adição das chaves de senha no cadastro, erro de menor de 18 anos (`underAge`) e redefinição de senha.

---

## 1. Schema Proposto (Tabelas, Colunas, Chaves e Índices)

Todas as tabelas residem no schema `public`. Os identificadores de usuário (`user_id`, `owner_id`, `author_id`, `reporter_id`) são `uuid` referenciando `public.profiles(id)`. Os identificadores de entidades de negócio usam `text` com prefixo semântico gerado no banco (ex.: `'d_' || encode(gen_random_bytes(8), 'hex')`), preservando 100% de compatibilidade com os IDs esperados pelo frontend.

### 1.1 `public.profiles` (Perfis de usuário)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Mesmo UUID do Supabase Auth |
| `role` | `text` | `NOT NULL DEFAULT 'student' CHECK (role = 'student')` | Papel fixo no MVP |
| `name` | `text` | `NOT NULL CHECK (char_length(trim(name)) >= 2)` | Nome de exibição |
| `email` | `text` | `NOT NULL` | E-mail sincronizado com `auth.users` |
| `phone` | `text` | `NULL` | Telefone opcional (sem verificação) |
| `birth_date` | `date` | `NOT NULL CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'))` | Data de nascimento (≥ 18 anos no banco) |
| `is_student` | `boolean` | `NOT NULL DEFAULT true` | Indicador informado no cadastro |
| `origin` | `text` | `NULL` | Como conheceu o Memora |
| `plan` | `text` | `NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium'))` | Plano da conta |
| `locale` | `text` | `NOT NULL DEFAULT 'pt-BR'` | Idioma da interface |
| `timezone` | `text` | `NOT NULL DEFAULT 'America/Sao_Paulo'` | Fuso horário para cálculo de `dayKey` |
| `onboarding_done` | `boolean` | `NOT NULL DEFAULT false` | Se concluiu a tela `/onboarding` |
| `onboarding_data` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | `{ context, subjects, minutesPerDay, at }` |
| `settings` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | `{ accessibility: { reduceMotion, largeText } }` |
| `notifications` | `jsonb` | `NOT NULL DEFAULT '{"intensity":"padrao","reminderTime":"19:00","push":true,"quietWindow":{"start":"23:00","end":"07:30","learned":true,"lockedForMinor":false},"limits":{"whatsappPerDay":3,"pushPerDay":8},"sentToday":{"whatsapp":0,"push":0}}'::jsonb` | Preferências de notificação |
| `public_profile` | `jsonb` | `NOT NULL DEFAULT '{"level":1,"topic":"Geral","points":0,"badges":[],"cardsGenerated":0,"bio":""}'::jsonb` | Dados públicos de autor na comunidade |
| `deactivated_at` | `timestamptz` | `NULL` | Preenchido quando o aluno desativa a conta |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data de criação |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Última atualização |

- **Índices:** `idx_profiles_email (email)`, `idx_profiles_active (id) WHERE deactivated_at IS NULL`.

### 1.2 `public.user_consents` (Consentimentos e Aceite de Política)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `user_id` | `uuid` | `PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono dos consentimentos |
| `school_share` | `boolean` | `NOT NULL DEFAULT false` | Mantido por compatibilidade de contrato |
| `whatsapp` | `jsonb` | `NOT NULL DEFAULT '{"lembretes":true,"conquistas":false,"conta":true,"informativo":false}'::jsonb` | Opt-ins de comunicação |
| `content_policy_accepted_version` | `text` | `NULL` | Versão aceita da política de publicação (ex.: `'v1.1'`) |
| `content_policy_accepted_at` | `timestamptz` | `NULL` | Timestamp do aceite da política de conteúdo |
| `privacy_policy_accepted_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Timestamp do aceite no cadastro |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Última alteração |

### 1.3 `public.folders` (Pastas de Decks)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('f_' || encode(gen_random_bytes(8), 'hex'))` | ID da pasta |
| `owner_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono da pasta |
| `parent_id` | `text` | `NULL REFERENCES public.folders(id) ON DELETE CASCADE` | Pasta pai (até 3 níveis) |
| `name` | `text` | `NOT NULL CHECK (char_length(trim(name)) >= 1)` | Nome da pasta |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data de criação |

- **Índices:** `idx_folders_owner (owner_id)`.

### 1.4 `public.decks` (Decks do Aluno)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('d_' || encode(gen_random_bytes(8), 'hex'))` | ID do deck |
| `owner_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono do deck |
| `folder_id` | `text` | `NULL REFERENCES public.folders(id) ON DELETE SET NULL` | Pasta onde está guardado |
| `name` | `text` | `NOT NULL CHECK (char_length(trim(name)) >= 1)` | Nome do deck |
| `category_id` | `text` | `NOT NULL DEFAULT 'outros'` | Categoria (`vestibular`, `concursos`, etc.) |
| `tags` | `text[]` | `NOT NULL DEFAULT '{}'` | Lista de tags |
| `difficulty` | `text` | `NOT NULL DEFAULT 'medio' CHECK (difficulty IN ('facil', 'medio', 'dificil'))` | Dificuldade |
| `lang` | `text` | `NOT NULL DEFAULT 'pt-BR'` | Idioma do deck |
| `scheduled` | `boolean` | `NOT NULL DEFAULT true` | Se entra na fila diária (`todaySession`) |
| `difficult` | `boolean` | `NOT NULL DEFAULT false` | Marcado como difícil |
| `focus` | `boolean` | `NOT NULL DEFAULT false` | Priorizado no início da fila |
| `complementary` | `boolean` | `NOT NULL DEFAULT false` | Marcado como complementar |
| `pinned` | `boolean` | `NOT NULL DEFAULT false` | Fixado para uso offline |
| `favorite` | `boolean` | `NOT NULL DEFAULT false` | Favorito próprio |
| `source` | `jsonb` | `NOT NULL DEFAULT '{"type":"vazio","document":null,"pages":null}'::jsonb` | Metadados da fonte de criação |
| `cloned_from` | `jsonb` | `NULL` | `{ deckId, authorId, authorName, version }` quando clonado |
| `publication_meta` | `jsonb` | `NOT NULL DEFAULT '{"status":"nao_publicado"}'::jsonb` | Estado resumido de publicação |
| `last_studied_at` | `timestamptz` | `NULL` | Última revisão feita neste deck |
| `deleted_at` | `timestamptz` | `NULL` | Soft delete |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data de criação |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Última atualização |

- **Índices:** `idx_decks_owner_active (owner_id, created_at DESC) WHERE deleted_at IS NULL`, `idx_decks_folder (folder_id) WHERE deleted_at IS NULL`.

### 1.5 `public.cards` (Cards com Campos FSRS)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('c_' || encode(gen_random_bytes(8), 'hex'))` | ID do card |
| `deck_id` | `text` | `NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE` | Deck ao qual pertence |
| `owner_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono do card (para RLS e índice direto) |
| `type` | `text` | `NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio'))` | Tipo do card |
| `front` | `text` | `NOT NULL CHECK (char_length(trim(front)) >= 1)` | Frente (pergunta) |
| `back` | `text` | `NOT NULL CHECK (char_length(trim(back)) >= 1)` | Verso (resposta) |
| `media` | `jsonb` | `NULL` | `{ kind, src, storagePath, alt, sizeKB, durationSec, transcript }` |
| `lang` | `text` | `NOT NULL DEFAULT 'pt-BR'` | Idioma do card |
| `origin` | `jsonb` | `NOT NULL DEFAULT '{"document":"Criado manualmente"}'::jsonb` | `{ document, page, excerpt, model, reader, promptVersion }` |
| `uncertain` | `boolean` | `NOT NULL DEFAULT false` | Sinalizado pela IA para conferência |
| `position` | `integer` | `NOT NULL DEFAULT 0` | Ordem no deck |
| `sched_state` | `text` | `NOT NULL DEFAULT 'new' CHECK (sched_state IN ('new', 'learning', 'review', 'relearning'))` | Estado FSRS |
| `sched_stability` | `numeric(10,3)` | `NOT NULL DEFAULT 0` | Estabilidade FSRS ($S$) |
| `sched_difficulty` | `numeric(5,2)` | `NOT NULL DEFAULT 5 CHECK (sched_difficulty >= 1 AND sched_difficulty <= 10)` | Dificuldade FSRS ($D \in [1, 10]$) |
| `sched_due` | `timestamptz` | `NOT NULL DEFAULT now()` | Próxima revisão programada |
| `sched_last_review` | `timestamptz` | `NULL` | Data/hora da última revisão |
| `sched_reps` | `integer` | `NOT NULL DEFAULT 0 CHECK (sched_reps >= 0)` | Total de repetições |
| `sched_lapses` | `integer` | `NOT NULL DEFAULT 0 CHECK (sched_lapses >= 0)` | Total de esquecimentos (`again`) |
| `sched_consecutive_lapses` | `integer` | `NOT NULL DEFAULT 0 CHECK (sched_consecutive_lapses >= 0)` | Erros seguidos |
| `edited_at` | `timestamptz` | `NULL` | Data da última edição manual |
| `deleted_at` | `timestamptz` | `NULL` | Soft delete |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data de criação |

- **Índices:**
  - `idx_cards_deck_pos (deck_id, position) WHERE deleted_at IS NULL`
  - `idx_cards_owner_due (owner_id, sched_due) WHERE deleted_at IS NULL`
  - `idx_cards_owner_lapses (owner_id, sched_lapses DESC) WHERE deleted_at IS NULL AND sched_lapses > 0`

### 1.6 `public.reviews` (Histórico de Revisões)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('rev_' || encode(gen_random_bytes(8), 'hex'))` | ID da revisão |
| `client_id` | `text` | `NOT NULL` | ID de idempotência gerado pelo cliente (`offlineQueue`) |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Aluno que revisou |
| `card_id` | `text` | `NULL REFERENCES public.cards(id) ON DELETE SET NULL` | Card próprio revisado (ou `NULL` se de comunidade) |
| `community_card_ref` | `text` | `NULL` | Referência quando revisado em preview comunitário |
| `deck_id` | `text` | `NOT NULL` | ID do deck estudado |
| `rating` | `text` | `NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy'))` | Nota FSRS atribuída |
| `duration_ms` | `integer` | `NULL CHECK (duration_ms IS NULL OR duration_ms >= 0)` | Tempo de resposta em ms |
| `offline` | `boolean` | `NOT NULL DEFAULT false` | Se foi sincronizado da fila offline |
| `plausible` | `boolean` | `NOT NULL DEFAULT true` | `true` se `abs(reviewed_at - received_at) <= 24h` |
| `reviewed_at` | `timestamptz` | `NOT NULL` | Momento em que o card foi respondido |
| `received_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Momento do recebimento no servidor |

- **Chave Única:** `uq_reviews_user_client UNIQUE (user_id, client_id)`.
- **Índices:** `idx_reviews_user_reviewed (user_id, reviewed_at DESC)`, `idx_reviews_user_deck (user_id, deck_id, reviewed_at DESC)`.

### 1.7 `public.study_settings` (Metas e Configuração Diária de Estudo)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `user_id` | `uuid` | `PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono da configuração |
| `goal` | `integer` | `NOT NULL DEFAULT 20 CHECK (goal >= 5 AND goal <= 200)` | Meta diária de cards |
| `goal_suggested` | `integer` | `NOT NULL DEFAULT 20` | Meta sugerida pelo onboarding/Nôa |
| `done_today` | `integer` | `NOT NULL DEFAULT 0 CHECK (done_today >= 0)` | Cards revisados no `day_key` atual |
| `day_key` | `text` | `NOT NULL` | Dia corrente `YYYY-MM-DD` no fuso do aluno |
| `goal_hit_day` | `text` | `NULL` | Último `day_key` em que recebeu o bônus da meta |
| `streak` | `integer` | `NOT NULL DEFAULT 0 CHECK (streak >= 0)` | Ofensiva atual em dias |
| `study_days` | `integer` | `NOT NULL DEFAULT 0 CHECK (study_days >= 0)` | Total acumulado de dias com estudo |
| `last_study_day` | `text` | `NULL` | Último `day_key` com revisão contabilizada |
| `last_study_at` | `timestamptz` | `NULL` | Timestamp da última revisão que contou streak (janela de 20h) |
| `skipped_day` | `text` | `NULL` | `day_key` reagendado (`POST /study/skip`) |
| `reschedules_week_key` | `text` | `NOT NULL` | Semana ISO `YYYY-Www` |
| `reschedules_used` | `integer` | `NOT NULL DEFAULT 0` | Reagendamentos usados na semana |
| `reschedules_limit` | `integer` | `NOT NULL DEFAULT 3` | Limite semanal de reagendamentos |
| `paused_until` | `timestamptz` | `NULL` | Fim da pausa de meta |
| `paused_at` | `timestamptz` | `NULL` | Início da pausa de meta |
| `fatigue_detection` | `boolean` | `NOT NULL DEFAULT true` | Se detecção de cansaço está ativa |
| `fatigue_keep_load_day` | `text` | `NULL` | `day_key` em que o aluno optou por manter carga normal |
| `plan_order` | `text[]` | `NOT NULL DEFAULT '{}'` | Ordem customizada de IDs de decks na sessão |
| `plan_adjustments` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Mapa `{ [deckId]: count }` de ajustes do dia |
| `community_answered` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Mapa `{ [pubDeckId]: count }` para regra de voto na comunidade |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Última atualização |

### 1.8 `public.objectives` (Objetivos de Estudo / Provas)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('obj_' || encode(gen_random_bytes(8), 'hex'))` | ID do objetivo |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono do objetivo |
| `name` | `text` | `NOT NULL CHECK (char_length(trim(name)) >= 1)` | Nome da prova/exame (ex.: `ENEM`) |
| `target_date` | `date` | `NOT NULL` | Data da prova (serializado como `date`) |
| `subjects` | `text[]` | `NOT NULL DEFAULT '{}'` | Matérias associadas |
| `priority` | `boolean` | `NOT NULL DEFAULT false` | Desempate para objetivos na mesma data |
| `outcome` | `text` | `NULL CHECK (outcome IN ('aprovado', 'reprovado', 'aguardando', 'nao_fiz'))` | Resultado pós-data |
| `outcome_at` | `timestamptz` | `NULL` | Quando o resultado foi registrado |
| `outcome_rewarded` | `boolean` | `NOT NULL DEFAULT false` | Se já creditou os 5 Neurônios |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data de criação |

- **Índices:** `idx_objectives_user_date (user_id, target_date ASC)`.

### 1.9 `public.generation_daily_usage` e `public.generation_jobs` (Geração de Decks)

#### `public.generation_daily_usage` (Uso diário de geração por usuário)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Usuário |
| `day_key` | `text` | `NOT NULL` | `YYYY-MM-DD` no fuso do aluno |
| `used` | `integer` | `NOT NULL DEFAULT 0 CHECK (used >= 0)` | Quantidade de gerações consumidas no dia |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Última atualização |

- **Chave Primária:** `PRIMARY KEY (user_id, day_key)`.

#### `public.generation_jobs` (Jobs de geração de decks)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('job_' || encode(gen_random_bytes(8), 'hex'))` | ID do job |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Dono do job |
| `idempotency_key` | `text` | `NULL` | Header `Idempotency-Key` |
| `plan` | `text` | `NOT NULL DEFAULT 'free'` | Plano no momento da criação |
| `source` | `text` | `NOT NULL CHECK (source IN ('camera', 'file', 'text', 'anki', 'empty'))` | Fonte do material |
| `document_name` | `text` | `NOT NULL` | Nome do arquivo ou documento |
| `storage_path` | `text` | `NULL` | Caminho no bucket `generation-uploads` |
| `text_preview` | `text` | `NOT NULL DEFAULT ''` | Primeiros 200 caracteres |
| `text_content` | `text` | `NULL` | Texto completo enviado para geração |
| `size_tokens` | `integer` | `NOT NULL DEFAULT 0` | Estimativa de tokens de entrada |
| `pages` | `integer` | `NOT NULL DEFAULT 1` | Estimativa de páginas |
| `legibility` | `text` | `NOT NULL DEFAULT 'ok'` | Qualidade de leitura |
| `status` | `text` | `NOT NULL CHECK (status IN ('criado', 'acima_do_orcamento', 'na_fila', 'lendo', 'gerando', 'tentando_novamente', 'pronto', 'aprovado', 'falhou', 'cancelado'))` | Status do pipeline |
| `scope` | `jsonb` | `NULL` | Recorte de páginas ou divisão |
| `over_budget` | `jsonb` | `NULL` | Detalhes quando excede 200k tokens |
| `tokens_budget` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Orçamento `{ input, output }` |
| `reader_model` | `text` | `NULL` | Modelo leitor utilizado |
| `generator_model` | `text` | `NULL` | Modelo gerador utilizado |
| `attempt` | `integer` | `NOT NULL DEFAULT 1` | Tentativa de execução |
| `quota_refunded` | `boolean` | `NOT NULL DEFAULT false` | Se devolveu a cota ao cancelar/falhar |
| `result` | `jsonb` | `NULL` | `{ suggested, cards, filters }` |
| `approved_deck_id` | `text` | `NULL REFERENCES public.decks(id) ON DELETE SET NULL` | Deck criado na aprovação |
| `ready_at` | `timestamptz` | `NULL` | Quando ficou `pronto` |
| `failed_at` | `timestamptz` | `NULL` | Quando `falhou` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Criação |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Atualização |

- **Chave Única:** `uq_gen_jobs_idempotency UNIQUE (user_id, idempotency_key)`.
- **Índices:** `idx_gen_jobs_user_created (user_id, created_at DESC)`.

### 1.10 `public.deck_publications` (Publicações de Deck na Comunidade)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('pub_' || encode(gen_random_bytes(8), 'hex'))` | ID da publicação (usado também como ID do deck comunitário no feed) |
| `deck_id` | `text` | `NOT NULL UNIQUE REFERENCES public.decks(id) ON DELETE CASCADE` | Deck original do autor |
| `public_id` | `text` | `NOT NULL UNIQUE DEFAULT ('p-' || encode(gen_random_bytes(6), 'hex'))` | Slug curto para `/d/:publicId` |
| `author_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Autor |
| `author_name` | `text` | `NOT NULL` | Nome do autor no momento da publicação |
| `name` | `text` | `NOT NULL` | Título publicado |
| `description` | `text` | `NOT NULL DEFAULT ''` | Descrição pública |
| `category_id` | `text` | `NOT NULL DEFAULT 'outros'` | Categoria |
| `difficulty` | `text` | `NOT NULL DEFAULT 'medio' CHECK (difficulty IN ('facil', 'medio', 'dificil'))` | Dificuldade |
| `lang` | `text` | `NOT NULL DEFAULT 'pt-BR'` | Idioma |
| `tags` | `text[]` | `NOT NULL DEFAULT '{}'` | Tags públicas |
| `version` | `integer` | `NOT NULL DEFAULT 1 CHECK (version >= 1)` | Versão publicada |
| `card_count` | `integer` | `NOT NULL DEFAULT 0 CHECK (card_count >= 1)` | Total de cards no snapshot |
| `snapshot` | `jsonb` | `NOT NULL DEFAULT '[]'::jsonb` | Array imutável de cards `{ id, type, front, back, media, lang }` |
| `status` | `text` | `NOT NULL DEFAULT 'aprovado' CHECK (status IN ('aprovado', 'rejeitado', 'despublicado'))` | Nasce como `'aprovado'` na moderação leve |
| `hidden_at` | `timestamptz` | `NULL` | Preenchido ao ocultar por moderação; feed ignora quando `IS NOT NULL` |
| `hidden_reason` | `text` | `NULL` | Motivo do ocultamento |
| `stats` | `jsonb` | `NOT NULL DEFAULT '{"studiedWeek":0,"votes":0,"favorites":0,"comments":0,"clones":0}'::jsonb` | Contadores agregados |
| `reactions` | `jsonb` | `NOT NULL DEFAULT '{"👏":0,"🔥":0,"🧠":0,"💡":0,"❤️":0,"😂":0}'::jsonb` | Contadores por emoji |
| `submitted_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data do envio |
| `published_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data de publicação |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Última atualização |

- **Índices:**
  - `idx_pub_visible_feed (published_at DESC) WHERE status = 'aprovado' AND hidden_at IS NULL`
  - `idx_pub_visible_category (category_id, published_at DESC) WHERE status = 'aprovado' AND hidden_at IS NULL`
  - `idx_pub_author (author_id)`

### 1.11 Comentários, Reações, Favoritos, Votos e Seguidores

#### `public.deck_comments` (Comentários e Respostas em Decks Publicados)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('cm_' || encode(gen_random_bytes(8), 'hex'))` | ID do comentário |
| `publication_id` | `text` | `NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE` | Publicação comentada |
| `parent_id` | `text` | `NULL REFERENCES public.deck_comments(id) ON DELETE CASCADE` | Comentário pai (quando for resposta) |
| `author_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Autor do comentário |
| `author_name` | `text` | `NOT NULL` | Nome do autor |
| `text` | `text` | `NOT NULL CHECK (char_length(trim(text)) BETWEEN 1 AND 2000)` | Conteúdo |
| `hidden_at` | `timestamptz` | `NULL` | Ocultado por moderação |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data |

- **Índices:** `idx_comments_pub_visible (publication_id, created_at DESC) WHERE hidden_at IS NULL`, `idx_comments_parent (parent_id)`.

#### `public.comment_likes` (Curtidas em Comentários)
- `comment_id text NOT NULL REFERENCES public.deck_comments(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `created_at timestamptz NOT NULL DEFAULT now()`
- **PK:** `(comment_id, user_id)`

#### `public.deck_reactions` (Reações com Emoji em Decks Publicados)
- `publication_id text NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `emoji text NOT NULL CHECK (emoji IN ('👏', '🔥', '🧠', '💡', '❤️', '😂'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- **PK:** `(publication_id, user_id, emoji)`

#### `public.deck_favorites` (Decks da Comunidade Favoritados pelo Aluno)
- `publication_id text NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `folder_id text NULL REFERENCES public.folders(id) ON DELETE SET NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- **PK:** `(publication_id, user_id)`
- **Índice:** `idx_deck_favorites_user (user_id, created_at DESC)`

#### `public.deck_votes` e `public.author_follows` (Apoio às rotas de Deck Comunitário e Perfil de Autor)
- `public.deck_votes`: `publication_id text REFERENCES public.deck_publications(id) ON DELETE CASCADE`, `user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE`, `weight integer NOT NULL DEFAULT 1`, `created_at timestamptz NOT NULL DEFAULT now()`, **PK:** `(publication_id, user_id)`.
- `public.author_follows`: `follower_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE`, `author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`, **PK:** `(follower_id, author_id)`.

### 1.12 `public.moderation_reports` (Denúncias)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('rep_' || encode(gen_random_bytes(8), 'hex'))` | ID da denúncia |
| `target_type` | `text` | `NOT NULL CHECK (target_type IN ('deck', 'comment'))` | Alvo denunciado |
| `target_id` | `text` | `NOT NULL` | ID da publicação ou comentário |
| `publication_id` | `text` | `NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE` | FK preenchida quando `target_type = 'deck'` |
| `comment_id` | `text` | `NULL REFERENCES public.deck_comments(id) ON DELETE CASCADE` | FK preenchida quando `target_type = 'comment'` |
| `target_name` | `text` | `NOT NULL` | Nome/resumo do alvo |
| `reason` | `text` | `NOT NULL CHECK (char_length(trim(reason)) >= 2)` | Motivo escolhido |
| `detail` | `text` | `NULL` | Detalhe adicional opcional |
| `reporter_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Quem denunciou |
| `status` | `text` | `NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'mantida', 'oculta'))` | Estado da revisão |
| `resolved_at` | `timestamptz` | `NULL` | Quando foi revisada |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data da denúncia |

- **Índices:** `idx_reports_open (status, created_at DESC) WHERE status = 'aberta'`, `idx_reports_target (target_type, target_id)`.

### 1.13 Nôa (`noa_daily_budget`, `noa_suggestions`, `noa_decisions`, `noa_chat_messages`)

#### `public.noa_daily_budget`
- `user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `day_key text NOT NULL`
- `suggestions_used integer NOT NULL DEFAULT 0`
- `suggestions_limit integer NOT NULL DEFAULT 5`
- `autonomous_used integer NOT NULL DEFAULT 0`
- `autonomous_limit integer NOT NULL DEFAULT 1`
- `chat_used integer NOT NULL DEFAULT 0`
- `chat_limit integer NOT NULL DEFAULT 20`
- **PK:** `(user_id, day_key)`

#### `public.noa_suggestions`
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('sug_' || encode(gen_random_bytes(8), 'hex'))` | ID da sugestão |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Aluno |
| `action_key` | `text` | `NOT NULL` | Chave do catálogo (`mark_difficult`, `adjust_goal`, etc.) |
| `deck_id` | `text` | `NULL REFERENCES public.decks(id) ON DELETE CASCADE` | Deck alvo (se aplicável) |
| `title` | `text` | `NOT NULL` | Título curto |
| `body` | `text` | `NOT NULL` | Explicação para o aluno |
| `payload` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | `{ showAfterCard, goal }` |
| `status` | `text` | `NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'dispensada'))` | Estado |
| `feedback` | `text` | `NULL` | Feedback opcional do aluno |
| `responded_at` | `timestamptz` | `NULL` | Quando respondeu |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Criação |

- **Índices:** `idx_noa_suggestions_user (user_id, status, created_at DESC)`.

#### `public.noa_decisions`
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('dec_' || encode(gen_random_bytes(8), 'hex'))` | ID da decisão |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Aluno |
| `action_key` | `text` | `NOT NULL` | Ação executada |
| `text` | `text` | `NOT NULL` | Descrição legível ao aluno |
| `reversible` | `boolean` | `NOT NULL DEFAULT true` | Se permite desfazer em 1 toque |
| `reverted` | `boolean` | `NOT NULL DEFAULT false` | Se foi revertida |
| `reverted_at` | `timestamptz` | `NULL` | Timestamp da reversão |
| `accepted` | `boolean` | `NULL` | Se veio de aceitação explícita |
| `previous_state` | `jsonb` | `NULL` | Snapshot do valor anterior (ex.: `{ planOrder }` ou `{ reminderTime }`) para reversão exata |
| `contested` | `jsonb` | `NULL` | `{ at, text, dueBy, status, reviewer }` (LGPD art. 20) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data/hora (`at` no JSON) |

- **Índices:** `idx_noa_decisions_user (user_id, created_at DESC)`.

#### `public.noa_chat_messages`
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('msg_' || encode(gen_random_bytes(8), 'hex'))` | ID da mensagem |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Aluno |
| `role` | `text` | `NOT NULL CHECK (role IN ('user', 'assistant', 'system'))` | Autor da mensagem |
| `content` | `text` | `NOT NULL CHECK (char_length(trim(content)) >= 1)` | Texto da mensagem |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | `{ deckId, model, tokens }` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Data/hora |

- **Índices:** `idx_noa_chat_user_created (user_id, created_at ASC)`.

### 1.14 `public.neuron_ledger` (Ledger Imutável de Neurônios)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `text` | `PRIMARY KEY DEFAULT ('led_' || encode(gen_random_bytes(8), 'hex'))` | ID do lançamento |
| `seq` | `bigint` | `GENERATED ALWAYS AS IDENTITY UNIQUE` | Sequencial monotônico para ordenação determinística |
| `user_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT` | Titular dos Neurônios |
| `amount` | `integer` | `NOT NULL CHECK (amount <> 0)` | Valor creditado (`> 0`) ou debitado (`< 0`) |
| `balance_after` | `integer` | `NOT NULL CHECK (balance_after >= 0)` | Saldo resultante após este lançamento (nunca negativo) |
| `type` | `text` | `NOT NULL CHECK (type IN ('daily_access', 'goal_bonus', 'objective_outcome', 'clone_bonus', 'referral_bonus', 'coupon_redeem', 'coupon_expired_refund'))` | Tipo de evento |
| `idempotency_key` | `text` | `NULL` | Chave de deduplicação (ex.: `daily_access:2026-11-12`) |
| `meta` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Contexto (`{ day, goal, objectiveId, deckId }`) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Timestamp (`ts` no JSON) |

- **Chave Única:** `uq_ledger_idempotency UNIQUE (user_id, idempotency_key)`.
- **Índices:** `idx_ledger_user_seq (user_id, seq DESC)`.

### 1.15 `public.audit_log` (Auditoria Mínima com Cadeia de Hash)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `seq` | `bigint` | `GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | Número de sequência |
| `actor` | `text` | `NOT NULL` | UUID do usuário ou identificador de agente (`noa`, `system`) |
| `actor_role` | `text` | `NOT NULL` | Papel (`student`, `agent`, `pipeline`) |
| `action` | `text` | `NOT NULL` | Nome da ação (`account_created`, `publication_submitted`, etc.) |
| `target` | `text` | `NOT NULL` | ID do recurso afetado |
| `details` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Metadados sem PII sensível |
| `prev_hash` | `text` | `NOT NULL` | Hash SHA-256 do registro `seq - 1` (ou `'GENESIS'`) |
| `hash` | `text` | `NOT NULL` | Hash SHA-256 desta linha |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Timestamp (`ts` no JSON) |

- **Índices:** `idx_audit_target (target, seq DESC)`, `idx_audit_actor (actor, seq DESC)`.

### 1.16 `public.rate_limits` (Contador de Rate Limit Compatível com Serverless)
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `key` | `text` | `NOT NULL` | Chave composta `<bucket>:<userId_ou_ip>` |
| `window_start` | `timestamptz` | `NOT NULL` | Início truncado da janela de tempo |
| `count` | `integer` | `NOT NULL DEFAULT 1 CHECK (count >= 1)` | Requisições acumuladas na janela |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Último incremento |

- **Chave Primária:** `PRIMARY KEY (key, window_start)`.
- **Índice de limpeza:** `idx_rate_limits_window (window_start)`.

---

## 2. Ledger de Neurônios Só-Inserção (Imutabilidade e Gravação Atômica)

### 2.1 Bloqueio Estrutural de `UPDATE` e `DELETE`
Além de **não existir política RLS** para `UPDATE` ou `DELETE` em `public.neuron_ledger`, uma trigger no próprio Postgres impede que até mesmo conexões administrativas ou `service_role` alterem ou apaguem linhas:

```sql
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'neuron_ledger is append-only: % is not allowed', TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_neuron_ledger_immutable
BEFORE UPDATE OR DELETE ON public.neuron_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();
```

### 2.2 Saldo Derivado do Último Registro
Não há coluna `balance` na tabela `profiles`. O saldo de qualquer usuário é sempre lido do último lançamento via índice `(user_id, seq DESC)`:
```sql
SELECT COALESCE(
  (SELECT balance_after FROM public.neuron_ledger WHERE user_id = p_user_id ORDER BY seq DESC LIMIT 1),
  0
);
```

### 2.3 Gravação Atômica sem Permitir Saldo Negativo
Toda escrita passa pela função RPC `public.append_neuron_ledger_entry`, executável **exclusivamente** pela `service_role`:

```sql
CREATE OR REPLACE FUNCTION public.append_neuron_ledger_entry(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.neuron_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.neuron_ledger;
  v_balance_before integer;
  v_balance_after integer;
  v_entry public.neuron_ledger;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('neuron_ledger:' || p_user_id::text));

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.neuron_ledger
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT COALESCE(
    (SELECT balance_after FROM public.neuron_ledger WHERE user_id = p_user_id ORDER BY seq DESC LIMIT 1),
    0
  ) INTO v_balance_before;

  v_balance_after := v_balance_before + p_amount;

  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.neuron_ledger (user_id, amount, balance_after, type, meta, idempotency_key)
  VALUES (p_user_id, p_amount, v_balance_after, p_type, COALESCE(p_meta, '{}'::jsonb), p_idempotency_key)
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.append_neuron_ledger_entry(uuid, integer, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_neuron_ledger_entry(uuid, integer, text, jsonb, text) TO service_role;
```

---

## 3. Políticas de RLS Tabela por Tabela e Proteção de Colunas

Todas as tabelas terão `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` e `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`. O papel `anon` não possui permissão em nenhuma tabela (o preview público `/v1/public/decks/:publicId` é servido pela API Express via consulta controlada que filtra `status = 'aprovado' AND hidden_at IS NULL`).

| Tabela | Quem Lê (`SELECT`) | Quem Cria (`INSERT`) | Quem Atualiza (`UPDATE`) | Quem Apaga (`DELETE`) |
|---|---|---|---|---|
| `profiles` | Próprio usuário (`auth.uid() = id`). Dados públicos de autores vêm de `deck_publications` ou view `v_public_authors` (sem `email`/`phone`/`birth_date`). | **Apenas `service_role`** (no `POST /v1/auth/register`). | Próprio usuário (`auth.uid() = id`), **com colunas sensíveis bloqueadas por trigger** (`plan`, `role`, `email`, `birth_date`, `deactivated_at`, `public_profile`). | Ninguém (desativação lógica via `deactivated_at`). |
| `user_consents` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`) ou `service_role`. | Próprio dono (`auth.uid() = user_id`). | Ninguém. |
| `folders` | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). |
| `decks` | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). |
| `cards` | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). | Próprio dono (`auth.uid() = owner_id`). |
| `reviews` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Ninguém (histórico imutável). | Ninguém. |
| `study_settings` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`) ou `service_role`. | Próprio dono (`auth.uid() = user_id`). | Ninguém. |
| `objectives` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). |
| `generation_daily_usage` | Próprio dono (`auth.uid() = user_id`). | **Apenas `service_role`** (negado para `authenticated`). | **Apenas `service_role`** (negado para `authenticated`). | Ninguém. |
| `generation_jobs` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`) ou `service_role`. | Próprio dono (`auth.uid() = user_id`) ou `service_role`. | Ninguém. |
| `deck_publications` | Qualquer autenticado se `status = 'aprovado' AND hidden_at IS NULL`; ou o próprio autor (`auth.uid() = author_id`). | Próprio autor (`auth.uid() = author_id AND hidden_at IS NULL`). | Próprio autor (`auth.uid() = author_id AND hidden_at IS NULL`) ou `service_role` (moderação). | Próprio autor (`auth.uid() = author_id`). |
| `deck_comments` | Qualquer autenticado se `hidden_at IS NULL` e a publicação pai estiver visível (`status = 'aprovado' AND hidden_at IS NULL`); ou o próprio autor (`auth.uid() = author_id`). | Autenticado onde `auth.uid() = author_id AND hidden_at IS NULL`. | `service_role` (para preencher `hidden_at`). | Próprio autor (`auth.uid() = author_id`). |
| `comment_likes` | Qualquer autenticado. | Próprio usuário (`auth.uid() = user_id`). | Ninguém. | Próprio usuário (`auth.uid() = user_id`). |
| `deck_reactions` | Qualquer autenticado. | Próprio usuário (`auth.uid() = user_id`). | Ninguém. | Próprio usuário (`auth.uid() = user_id`). |
| `deck_favorites` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). |
| `deck_votes` | Qualquer autenticado. | Próprio usuário (`auth.uid() = user_id`). | Ninguém. | Próprio usuário (`auth.uid() = user_id`). |
| `author_follows` | Qualquer autenticado. | Próprio seguidor (`auth.uid() = follower_id`). | Ninguém. | Próprio seguidor (`auth.uid() = follower_id`). |
| `moderation_reports` | Próprio denunciante (`auth.uid() = reporter_id`) e `service_role` / painel Supabase. | Autenticado onde `auth.uid() = reporter_id`. | Apenas `service_role` / painel Supabase. | Ninguém. |
| `noa_daily_budget` | Próprio dono (`auth.uid() = user_id`). | **Apenas `service_role`** (negado para `authenticated`). | **Apenas `service_role`** (negado para `authenticated`). | Ninguém. |
| `noa_suggestions` | Próprio dono (`auth.uid() = user_id`). | `service_role` / dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Ninguém. |
| `noa_decisions` | Próprio dono (`auth.uid() = user_id`). | `service_role` / dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`). | Ninguém. |
| `noa_chat_messages` | Próprio dono (`auth.uid() = user_id`). | Próprio dono (`auth.uid() = user_id`) ou `service_role`. | Ninguém. | Ninguém. |
| `neuron_ledger` | Próprio dono (`auth.uid() = user_id`). | **Apenas `service_role` via RPC** (negado para `authenticated`). | **Bloqueado por trigger**. | **Bloqueado por trigger**. |
| `audit_log` | **Apenas `service_role` / painel Supabase** (negado para `authenticated`). | **Apenas `service_role` via RPC**. | **Bloqueado por trigger**. | **Bloqueado por trigger**. |
| `rate_limits` | **Apenas `service_role` via RPC** (negado para `authenticated`). | **Apenas `service_role` via RPC**. | **Apenas `service_role` via RPC**. | **Apenas `service_role`**. |

### 3.1 Proteção por Coluna em `public.profiles` e Teste de Segurança
Para impedir que um usuário autenticado use a `SUPABASE_ANON_KEY` + seu próprio JWT diretamente contra o PostgREST do Supabase para elevar seu plano (`plan`), alterar `role`, trocar `email`, adulterar `birth_date`, limpar `deactivated_at` ou inflar `public_profile` (pontos/nível/cardsGenerated):

```sql
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'authenticated'
     OR session_user = 'authenticated' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.birth_date IS DISTINCT FROM OLD.birth_date
       OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
       OR NEW.public_profile IS DISTINCT FROM OLD.public_profile THEN
      RAISE EXCEPTION 'protected_profile_column_modification_forbidden'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_protect_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
```

- **Teste Obrigatório de Segurança RLS:** usando cliente instanciado com `SUPABASE_ANON_KEY` + JWT de usuário autenticado:
  1. Tentar `UPDATE generation_daily_usage SET used = 0` ou `UPDATE noa_daily_budget SET chat_used = 0` deve falhar / afetar `0` linhas (RLS bloqueia escrita para `authenticated`).
  2. Tentar `UPDATE profiles SET plan = 'premium'` ou alterar `public_profile` deve falhar com erro `42501` (`protected_profile_column_modification_forbidden`).

---

## 4. Moderação Leve

1. **Publicação nasce aprovada:**
   - Ao chamar `POST /v1/decks/:id/publish`, após validar conta ativa (`deactivated_at IS NULL`), e-mail confirmado, aceite da política de conteúdo e deck com ao menos 1 card, `deck_publications` recebe `status = 'aprovado'`, `hidden_at = NULL`, `published_at = now()` e o `snapshot` dos cards.
   - O deck entra imediatamente no feed da comunidade (`GET /v1/community/feed`) e na busca (`GET /v1/community/search`), sem fila `em_triagem` dependente de painel administrativo.
2. **Registro de denúncias:**
   - `POST /v1/community/decks/:id/report` e `POST /v1/community/comments/:id/report` inserem em `public.moderation_reports` com `status = 'aberta'`.
3. **Respeito à coluna `hidden_at`:**
   - Tanto a policy de RLS quanto todas as queries de `community.repo.js` (`listVisiblePublications`, `searchVisiblePublications`, `getPublicationById`, `listComments`) aplicam `WHERE status = 'aprovado' AND hidden_at IS NULL` (para decks) e `WHERE hidden_at IS NULL` (para comentários).
4. **View e Função Prontas para Revisão no Painel do Supabase:**
   - A migration `20261112000500_community_and_moderation.sql` criará a view `public.v_moderation_queue` (acessível no Table Editor / SQL Editor do Supabase) e a função `public.moderate_hide_target`:

```sql
CREATE OR REPLACE VIEW public.v_moderation_queue AS
SELECT
  r.target_type,
  r.target_id,
  r.target_name,
  COUNT(*) FILTER (WHERE r.status = 'aberta') AS open_reports_count,
  COUNT(*) AS total_reports_count,
   MAX(r.created_at) AS last_reported_at,
  ARRAY_AGG(DISTINCT r.reason) AS reasons,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'reportId', r.id,
      'reason', r.reason,
      'detail', r.detail,
      'reporterId', r.reporter_id,
      'status', r.status,
      'createdAt', r.created_at
    ) ORDER BY r.created_at DESC
  ) AS reports,
  COALESCE(p.author_id, c.author_id) AS author_id,
  COALESCE(p.author_name, c.author_name) AS author_name,
  COALESCE(p.hidden_at, c.hidden_at) AS target_hidden_at,
  CASE
    WHEN r.target_type = 'deck' THEN p.snapshot
    ELSE JSONB_BUILD_OBJECT('text', c.text, 'publicationId', c.publication_id)
  END AS content_preview
FROM public.moderation_reports r
LEFT JOIN public.deck_publications p ON r.target_type = 'deck' AND r.publication_id = p.id
LEFT JOIN public.deck_comments c ON r.target_type = 'comment' AND r.comment_id = c.id
GROUP BY
  r.target_type, r.target_id, r.target_name,
  p.author_id, p.author_name, p.hidden_at, p.snapshot,
  c.author_id, c.author_name, c.hidden_at, c.text, c.publication_id
ORDER BY open_reports_count DESC, last_reported_at DESC;
```

E para ocultar ou dispensar rapidamente pelo SQL Editor do Supabase:
```sql
SELECT public.moderate_hide_target('deck', 'pub_xxxx', 'Conteúdo impróprio confirmado');
```
*(A função preenche `hidden_at = now()`, `hidden_reason` na publicação/comentário e marca todas as denúncias abertas daquele `target_id` como `status = 'oculta'`, `resolved_at = now()`).*

---

## 5. Fluxo de Auth Completo (Supabase Auth + API Express)

### 5.1 Cadastro Fechado por Convite e Validação de Idade ≥ 18 no Servidor
1. **Signup público desligado no Supabase Auth:** No painel do Supabase (`Authentication > Providers / User Signups`), o cadastro público (`Allow new users to sign up`) fica **DESLIGADO**. O frontend **nunca** chama `supabase.auth.signUp` diretamente.
2. Na tela `/criar-conta` (`RegisterPage.jsx`), o usuário preenche: `name`, `email`, `password` (mínimo 8 caracteres), `birthDate`, `inviteCode` (código de convite), `student` (`sim`/`nao`) e `origin` (opcional).
3. O frontend envia `POST /v1/auth/register` para a API Express.
4. **Validação de Convite e Idade ≥ 18 no Servidor (`backend/src/routes/auth.js`):**
   - **Código de convite (`INVITE_CODE`):** O servidor compara `inviteCode` (em comparação de tempo constante) com `process.env.INVITE_CODE`. Se ausente ou divergente → rejeita com `403 invalid_invite_code`.
   - **Idade ≥ 18 anos:** O servidor calcula a idade exata a partir de `birthDate`. Se `birthDate` for inválida ou `age < 18`, rejeita imediatamente com `422 under_age`:
     `fail(res, 422, 'under_age', 'O Memora é exclusivo para maiores de 18 anos.', { errors: { birthDate: 'Você precisa ter pelo menos 18 anos para criar uma conta.' } })`.
   - Dessa forma, menores de 18 anos e pessoas sem convite não chegam sequer a criar usuário em `auth.users`, e a constraint `CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'))` em `public.profiles` atua como segunda barreira no banco.
5. **Criação no Servidor via `service_role`:**
   - Após validar convite e maioridade, o servidor chama `serviceClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })`.
   - Em seguida, provisiona as linhas iniciais em `public.profiles`, `public.study_settings`, `public.user_consents` e `public.noa_daily_budget`, registra `account_created` em `public.audit_log`, autentica a sessão (`signInWithPassword`) e devolve `{ token, refreshToken, user }` já pronto para avançar para `/onboarding`.
6. A tela `/verificar-idade` (`AgeVerificationPage` de upload de RG/selfie e responsável legal) é desligada por flag (`FEATURES.ageVerificationScreen = false`), pois não há menores no MVP.

### 5.2 Confirmação de E-mail: Opções, Limites do Supabase e Riscos
O servidor de e-mail embutido do Supabase Auth possui restrições severas por padrão:
- **Limite de envio:** máximo de **2 a 4 e-mails por hora** somando todo o projeto (cadastros + reenvios + recuperação de senha).
- **Restrição de destinatários e entregabilidade:** sem SMTP customizado, e-mails podem ser bloqueados pelo Supabase para endereços fora da organização ou cair na caixa de spam de Gmail/Outlook.

Apresentamos **3 opções** para decisão (ver Seção 12):

| Opção | Como funciona | Vantagens | Riscos / Requisitos |
|---|---|---|---|
| **Opção A (Recomendada para 5 testadores no prazo de 14/11)** | Desabilitar `"Confirm email"` no painel do Supabase Auth (`Authentication > Providers > Email`). O cadastro já autentica o usuário na hora e leva direto ao `/onboarding`. | Zero risco dos testadores travarem no cadastro por limite de 2 e-mails/hora; fluxo imediato; sem necessidade de configurar DNS/domínio agora. | Se o testador digitar o próprio e-mail errado no cadastro, a conta será criada com o e-mail incorreto. |
| **Opção B (Confirmação ativa + SMTP Externo Resend/Brevo)** | Manter `"Confirm email"` ligado no Supabase e configurar Custom SMTP (Resend ou Brevo gratuito, 100–300 e-mails/dia) com confirmação via código OTP de 6 dígitos (`verifyOtp`) na tela `/confirmar`. | Confirmação real de propriedade do e-mail e recuperação de senha confiável sem rate limit de 2/h. | Exige que você tenha um domínio próprio com acesso ao DNS (SPF/DKIM) para configurar no Resend/Brevo antes do deploy. |
| **Opção C (Confirmação ativa + SMTP Embutido do Supabase)** | Manter `"Confirm email"` ligado usando o SMTP default do Supabase. | Sem configuração de DNS externo. | **Alto risco operacional:** se 3 testadores criarem conta ou pedirem código na mesma hora, o Supabase bloqueará com erro `429 over_email_send_rate_limit`. |

> **Compatibilidade no código:** Em qualquer opção escolhida, `ConfirmPage.jsx` e `POST /v1/auth/confirm` não terão mais verificação de telefone nem código fixo `123456`. Se o usuário já vier com `email_confirmed_at` preenchido (Opção A), `/criar-conta` redireciona direto para `/onboarding`; se exigir confirmação (Opções B/C), redireciona para `/confirmar`, que valida o OTP/token real no Supabase Auth (`supabase.auth.verifyOtp({ email, token, type: 'signup' })`).

### 5.3 Login e Validação de JWT na API
1. Na tela `/entrar` (`LoginPage.jsx`), o usuário informa `email` e `password`.
2. O frontend autentica via `supabase.auth.signInWithPassword({ email, password })` (ou via `POST /v1/auth/login` que delega a `signInWithPassword` no Supabase Auth e retorna `{ token: session.access_token, refreshToken: session.refresh_token, user }`).
3. O `SessionContext` sincroniza a sessão com `supabase.auth.onAuthStateChange`, garantindo que o `access_token` (JWT de 1h) seja atualizado automaticamente pelo refresh token do Supabase e repassado a `studentApi.setToken(session.access_token)`.
4. Em cada requisição `/v1/*`, o middleware `requireRole` (`backend/src/lib/auth.js`):
   - Extrai o `Bearer <jwt>` do header `Authorization`.
   - Valida o token chamando `userClient.auth.getUser(token)`. Se inválido ou expirado → `401 unauthorized`.
   - Instancia `req.db = createUserClient(token)` (cliente Supabase autenticado com o JWT do usuário para o RLS atuar como 2ª camada).
   - Carrega o perfil em `public.profiles` via `req.db`. Se a idade registrada for `< 18` → `403 forbidden`.
   - Popula `req.user` e segue para a rota.

### 5.4 Logout
1. O aluno aciona "Sair" no menu do usuário.
2. O frontend chama `supabase.auth.signOut()` e `POST /v1/auth/logout`, limpa `studentApi.setToken(null)` e `storage.remove('memora.cache.me')`, e redireciona para `/entrar`.

### 5.5 Recuperação de Senha
1. Em `/recuperar-senha` (`RecoverPage.jsx`), o aluno informa seu e-mail.
2. A aplicação dispara `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/recuperar-senha?mode=reset` })` (ou via `POST /v1/auth/password/recover`).
3. Quando o aluno abre o link recebido por e-mail, o Supabase Auth estabelece uma sessão de recuperação (`PASSWORD_RECOVERY`) e `RecoverPage.jsx` exibe o formulário de nova senha (mínimo 8 caracteres), que chama `supabase.auth.updateUser({ password })` e `POST /v1/me/password` para registrar o evento `password_changed` no `audit_log`.

---

## 6. Camada de Acesso a Dados (`backend/src/data/`) e Migração Rota a Rota

### 6.1 Isolamento do Banco em `backend/src/data/`
Nenhuma rota em `backend/src/routes/*.js` importará `@supabase/supabase-js` nem escreverá queries SQL/PostgREST diretamente. Toda operação passa por `req.data.<dominio>`:

- `req.data.profiles` (`backend/src/data/profiles.repo.js`)
- `req.data.decks` (`backend/src/data/decks.repo.js`)
- `req.data.study` (`backend/src/data/study.repo.js`)
- `req.data.generation` (`backend/src/data/generation.repo.js`)
- `req.data.community` (`backend/src/data/community.repo.js`)
- `req.data.noa` (`backend/src/data/noa.repo.js`)
- `req.data.ledger` (`backend/src/data/ledger.repo.js`)
- `req.data.audit` (`backend/src/data/audit.repo.js`)

Cada método de repositório recebe o cliente de banco escopado pelo JWT do usuário (`req.db`) para operações normais, e apenas os métodos explícitos de sistema usam internamente `createServiceClient()`.

### 6.2 Preservação do Contrato com o Frontend
Para que nenhum componente React quebre (Regra 9):
1. **`mappers.js` mantém 100% do shape JSON atual:**
   - Em `cards`: converte as colunas `sched_state`, `sched_stability`, `sched_difficulty`, `sched_due`, `sched_last_review`, `sched_reps`, `sched_lapses`, `sched_consecutive_lapses` de volta para o objeto aninhado `card.sched = { state, stability, difficulty, due, lastReview, reps, lapses, consecutiveLapses }`.
   - Em `decks`: calcula `progress: { total, due, mastered, learning, offlineAvailable, offlineReason }`, `cardCount` e `categoryName` exatamente como `deckSummary()` fazia.
   - Em `me`: retorna `{ user: publicUser(...), dailyCredit, notifications, consents, subscription: { plan: user.plan, payments: [], cancelledAt: null } }`.
   - Em `wallet`: retorna `{ balance, ledger, redeemable: false, redeemableCount: 0, nextCoupon: null, cheapest: null, canRedeem: { ok: false, studyDays, required: 10, verified: true }, abuseFlag: false, myCoupons: [], referral: null, rules: { dailyAccess: 1, goalBonus: 5, neverPurchasable: true, expiryRefund: true } }`.
2. **Eliminação de `setTimeout` na Geração de Decks (`POST /v1/generation/jobs`):**
   - No protótipo, `POST /v1/generation/jobs` retornava `status: 'na_fila'` e agendava `store.later(..., 600 / 2600 / 6000)` em memória.
   - No MVP Serverless, `POST /v1/generation/jobs` valida o filtro de PII, a cota diária (`generation_daily_usage`) e o orçamento de 200k tokens. Se estiver dentro do orçamento, executa a geração **sincronamente dentro da própria requisição** (ou na primeira chamada de `GET /v1/generation/jobs/:id` caso iniciada como `'gerando'`), salvando o job já com `status: 'pronto'`, `ready_at: now()` e `result` populado no Postgres.
   - O frontend (`CreatePage.jsx` → `GenerationProgress.jsx` → `GenerationReview.jsx`) já trata o estado `job.status === 'pronto'` redirecionando imediatamente para `/app/criar/:jobId/revisar` sem precisar mudar uma linha sequer do contrato!

---

## 7. Remoção do Que Não Pode Ir para Produção

1. **Rotas `/_proto/*`:**
   - Desmontadas de `backend/src/app.js` quando `FEATURES.proto === false` (padrão `false`). Qualquer chamada a `/v1/_proto/*` retorna `404 not_found`.
2. **`ProtoBar` e `ProtoContext`:**
   - `<ProtoBar />` removida da árvore de renderização em `frontend/src/app/App.jsx` quando `!FEATURES.protoBar`.
   - `ProtoProvider` não faz mais `GET /_proto/state` nem intercepta conectividade com `setSimulatedOffline`.
3. **Atalhos de Login e Códigos Fixos:**
   - Removido o botão `"Entrar com conta de demonstração"` (`provider: 'demo'`) e os botões mockados de login social sem OAuth (`google`, `microsoft`) em `frontend/src/features/auth/LoginPage.jsx`.
   - Removido o fallback que logava automaticamente na conta `u1` (`Manoel`) em `backend/src/routes/auth.js`.
   - Removido o código fixo `'123456'` e a dica `"No protótipo, o código é 123456"` de `backend/src/routes/auth.js` e `frontend/src/i18n/pt-BR/auth.js`.
4. **Proteção de `.env` e Criação de `.env.example`:**
   - Adição ao `.gitignore`:
     ```gitignore
     .env
     .env.*
     !.env.example
     .vercel/
     ```
   - Criação do arquivo `.env.example` na raiz contendo apenas os nomes das variáveis (ver Seção 9).
5. **Rate Limit (Compatível com Serverless), Cabeçalhos de Segurança, CORS Restrito e Limite de Body (Sem Dependências Novas):**
   - **Proposta de Solução (Zero Dependências Externas):**
     - **Rate Limit no Postgres (`public.rate_limits` + RPC `public.check_rate_limit`):** Como instâncias serverless na Vercel não compartilham memória, o controle de taxa usa uma função atômica no Postgres (`INSERT INTO public.rate_limits ... ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count <= p_limit`). Nos testes automatizados sem banco real, o middleware `backend/src/lib/rateLimit.js` usa um contador local isolado por instância de app.
     - **Rotas protegidas por Rate Limit:**
       - `auth` (`POST /v1/auth/login`, `POST /v1/auth/register`, `POST /v1/auth/password/recover`): **10 requisições / 15 min por IP** (`429 rate_limited`).
       - `ai` (`POST /v1/generation/jobs`, `POST /v1/noa/chat`): **10 requisições / 1 min por `user.id`** (além da cota diária em `generation_daily_usage` e `noa_daily_budget`).
       - `publish` (`POST /v1/decks/:id/publish`): **10 requisições / 1 hora por `user.id`**.
       - `comment_report` (`POST /v1/community/decks/:id/comments`, `POST /v1/community/decks/:id/report`, `POST /v1/community/comments/:id/report`): **20 requisições / 10 min por `user.id`**.
     - **Cabeçalhos de Segurança (`backend/src/lib/security.js`):** Middleware próprio em `app.js` aplicando `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()` e, em produção, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
     - **CORS Restrito:** Em produção, `cors()` valida `Origin` estritamente contra a lista `CORS_ALLOWED_ORIGIN` (separada por vírgula), bloqueando origens externas arbitrárias; requisições same-origin (via rewrite da Vercel) e ambiente local de desenvolvimento/teste continuam funcionando normalmente.
     - **Limite de Tamanho de Body:** `express.json({ limit: '100kb' })` em `backend/src/app.js` (substituindo o antigo `2mb`, já que PDFs de até 50 páginas serão enviados diretamente ao Supabase Storage na Etapa 7B).

---

## 8. Mecanismo de Flags para Desligar Features Fora do Escopo

Seguindo a **Regra 5** (*"Não desligue features apagando código: tire a rota do app.js e a tela da navegação por flag de configuração"*) e a **Regra 10** (*"Fora do MVP: painéis parental/B2B/back-office/parceiro, MCP e Recebidos, materiais (quiz, mapa, linha do tempo, blog), grupos de estudo, ranking, assinatura, cupons"*):

### 8.1 Flags no Backend (`backend/src/config/features.js`)
| Flag | Valor no MVP | Rotas Desligadas em `app.js` e nos Routers |
|---|---|---|
| `panels` | `false` | `/v1/parental/*`, `/v1/b2b/*`, `/v1/admin/*`, `/v1/partner/*` |
| `proto` | `false` | `/v1/_proto/*` |
| `mcp` | `false` | `/v1/mcp/*` (todas as 12 rotas de conexões, inbox, requests e protocolo MCP) |
| `materials` | `false` | `/v1/community/materials/*`, `/v1/me/materials/*`, `/v1/me/publications` |
| `studyGroups` | `false` | `/v1/community/groups*`, `/v1/community/group-posts/*` |
| `rankings` | `false` | `/v1/community/rankings` (e oculta `rankingWeek`/`creatorOfMonth` no `/v1/community/feed`) |
| `subscriptions` | `false` | `/v1/subscription/*` |
| `coupons` | `false` | `/v1/coupons*`, `/v1/wallet/coupons*` |
| `folderSharing` | `false` | `/v1/folders/:id/members*` |
| `guardian` | `false` | `/v1/me/guardian-requests*` |
| `supportTickets` | `false` | `/v1/support/tickets*` |

### 8.2 Flags no Frontend (`frontend/src/config/features.js`)
| Flag | Valor no MVP | Efeito na Navegação e nas Rotas (`App.jsx` / `StudentLayout.jsx` / `ProfileHome.jsx`) |
|---|---|---|
| `panels` | `false` | Remove as rotas `/parental/*`, `/parceiro/*`, `/b2b/*`, `/admin/*` do `AppRoutes`. |
| `protoBar` | `false` | Não renderiza `<ProtoBar />` nem dispara `/_proto/*`. |
| `mcp` | `false` | Remove `/app/perfil/conexoes` e `/app/recebidos` do `AppRoutes`, da barra lateral (`NAV_GROUPS`), do `UserMenu`, do `ProfileHome` e da origem de criação em `CreatePage.jsx`; desativa `McpArrivalWatcher`. |
| `materials` | `false` | Remove `/app/comunidade/conteudo/:materialId` e `/app/perfil/blog/*`; oculta `MyBlogPanel` no perfil e filtros de materiais na Comunidade e na Nôa. |
| `studyGroups` | `false` | Remove `/app/comunidade/grupos*` do `AppRoutes` e oculta a seção de grupos em `CommunityHome.jsx`. |
| `rankings` | `false` | Oculta bloco de ranking semanal e criador do mês em `CommunityHome.jsx`. |
| `subscriptions` | `false` | Remove `/app/perfil/assinatura` do `AppRoutes`, do `UserMenu` e do `ProfileHome`. |
| `coupons` | `false` | Remove `/app/carteira/cupom/:couponId` e `/app/carteira/meus/:myCouponId`; em `WalletPage.jsx` exibe apenas saldo de Neurônios, regras de ganho e extrato do ledger. |
| `folderSharing` | `false` | Oculta ação de compartilhar pasta com membros externos em `DeckDetail.jsx` e `FolderDetail.jsx`. |
| `phoneVerification` | `false` | Oculta etapa de código por SMS/WhatsApp em `ConfirmPage.jsx`. |
| `ageVerificationScreen` | `false` | Remove `/verificar-idade` do fluxo pós-cadastro (idade ≥ 18 já validada no cadastro). |

---

## 9. Variáveis de Ambiente e Estrutura de Migrations SQL

### 9.1 Nomes das Variáveis de Ambiente (`.env.example`)
```dotenv
# Ambiente, Segurança e Cadastro
NODE_ENV=
PORT=
CORS_ALLOWED_ORIGIN=
INVITE_CODE=

# Supabase (Backend / Serverless Functions)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Supabase (Frontend Vite)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Inteligência Artificial — Google Gemini Flash (Servidor apenas)
GEMINI_API_KEY=
GEMINI_MODEL_GENERATION=
GEMINI_MODEL_NOA=
NOA_DAILY_CHAT_LIMIT=
ALLOW_DETERMINISTIC_AI_FALLBACK=
```

### 9.2 Estrutura de Migrations Versionadas (`supabase/migrations/`)
Os arquivos seguem o padrão cronológico `YYYYMMDDHHMMSS_nome_descritivo.sql` do Supabase CLI:
1. `supabase/migrations/20261112000100_extensions_and_helpers.sql`
   - `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
   - Função `public.set_updated_at()` para triggers de `updated_at`.
   - Função `public.is_adult(birth_date date)` (`birth_date <= (CURRENT_DATE - INTERVAL '18 years')`).
2. `supabase/migrations/20261112000200_profiles_and_consents.sql`
   - Tabelas `public.profiles`, `public.user_consents`, `public.study_settings`, `public.objectives` e índices.
3. `supabase/migrations/20261112000300_decks_cards_reviews.sql`
   - Tabelas `public.folders`, `public.decks`, `public.cards` (com campos FSRS) e `public.reviews` + índices compostos de estudo.
4. `supabase/migrations/20261112000400_generation_and_noa.sql`
   - Tabelas `public.generation_daily_usage`, `public.generation_jobs`, `public.noa_daily_budget`, `public.noa_suggestions`, `public.noa_decisions`, `public.noa_chat_messages`.
5. `supabase/migrations/20261112000500_community_and_moderation.sql`
   - Tabelas `public.deck_publications`, `public.deck_comments`, `public.comment_likes`, `public.deck_reactions`, `public.deck_favorites`, `public.deck_votes`, `public.author_follows`, `public.moderation_reports`, view `public.v_moderation_queue` e função `public.moderate_hide_target`.
6. `supabase/migrations/20261112000600_ledger_and_audit.sql`
   - Tabelas `public.neuron_ledger` e `public.audit_log`, triggers de bloqueio de `UPDATE`/`DELETE`, funções RPC `public.append_neuron_ledger_entry` e `public.append_audit_entry` com permissões restritas à `service_role`.
7. `supabase/migrations/20261112000700_rls_policies.sql`
   - `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` em todas as tabelas e criação de todas as policies descritas na Seção 3.
8. `supabase/migrations/20261112000800_storage_buckets.sql`
   - Criação dos buckets `card-media` e `generation-uploads` em `storage.buckets` e policies em `storage.objects` restritas ao prefixo `(storage.foldername(name))[1] = auth.uid()::text`.

---

## 10. ADRs Curtas Propostas

### 10.1 `docs/adr/0012-persistencia-postgres-supabase-e-rls.md` (Substitui a ADR-0001)

```markdown
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
3. A API instancia o cliente Supabase repassando o JWT do usuário autenticado em todas as operações
   de domínio, fazendo com que as políticas de **Row Level Security (RLS)** do Postgres atuem como
   segunda camada de defesa. O uso de `service_role` fica restrito a quatro operações explícitas no
   servidor: gravação atômica no ledger de Neurônios via RPC, atualização de jobs/cotas de IA,
   escrita no log de auditoria e rotina de moderação.
4. O pipeline de geração de decks não utiliza mais `setTimeout` nem estado em memória.

## Consequências

- **A favor**: persistência real compatível com deploy serverless na Vercel; defesa em profundidade
  (autorização na API Express + RLS no Postgres); preservação integral dos contratos JSON consumidos
  pelo frontend.
- **Contra**: exige gerenciar migrations SQL versionadas (`supabase/migrations/`) e variáveis de
  ambiente; a latência de cada rota passa a incluir o round-trip até o Postgres do Supabase.
```

### 10.2 `docs/adr/0013-autenticacao-supabase-auth-jwt-adultos.md` (Substitui a ADR-0008)

```markdown
# ADR-0013 — Autenticação via Supabase Auth (JWT) exclusiva para maiores de 18 anos

## Status

Aceita (substitui a [ADR-0008](./0008-autenticacao-por-sessao-simples.md)).

## Contexto

A ADR-0008 aceitava qualquer credencial em `POST /auth/login`, emitia tokens opacos em memória
(`tok_...`), usava código fixo `123456` para confirmação e continha fluxos de verificação parental
para menores de idade. Para o MVP real voltado exclusivamente a testadores adultos (≥ 18 anos), é
necessário autenticação real com hash de senha, sessão persistente baseada em JWT e bloqueio de
cadastro de menores no servidor.

## Decisão

1. A autenticação passa a ser feita pelo **Supabase Auth** (e-mail e senha), com o **signup público
   desligado** no painel do Supabase. Todos os atalhos de demonstração, tokens em memória e o código
   fixo `123456` são removidos.
2. O cadastro acontece exclusivamente via `POST /v1/auth/register` no servidor (usando `service_role`
   com `auth.admin.createUser`), exigindo código de convite (`INVITE_CODE`) e validando **idade ≥ 18
   anos no servidor** e em constraint `CHECK` em `public.profiles`.
3. O frontend obtém o JWT (`access_token`) no Supabase Auth e o envia no header
   `Authorization: Bearer <jwt>` em todas as chamadas à API Express (`/v1/*`).
4. O middleware `requireRole` / `requireStudent` na API Express valida o JWT junto ao Supabase Auth,
   cria um cliente de banco escopado com esse JWT (`req.db`) e carrega o perfil do aluno em
   `public.profiles`.

## Consequências

- **A favor**: senhas gerenciadas com segurança pelo Supabase Auth (bcrypt/Argon2, recuperação de
  senha e renovação de token); bloqueio total de cadastros não autorizados ou de menores de 18 anos
  antes mesmo de tocar no `auth.users`; compatibilidade nativa com `auth.uid()` nas políticas de RLS.
- **Contra**: testes automatizados da API precisam usar mocks da camada de auth/dados ou um projeto
  Supabase de teste.
```

---

## 11. Ordem de Execução em Etapas Pequenas (com Critério de Pronto Verificável)

Executaremos **uma etapa por vez**, com 1 commit ao final de cada uma, parando para sua validação antes de iniciar a próxima:

### Etapa 1 — Higiene de Produção, Flags de Escopo, Hardening HTTP, `.env.example` e ADRs
- **O que será feito:**
  - Atualizar `.gitignore` e criar `.env.example`.
  - Criar `backend/src/config/features.js` e `frontend/src/config/features.js`.
  - Criar `backend/src/lib/security.js` (cabeçalhos de segurança + CORS restrito) e aplicar limite `express.json({ limit: '100kb' })` em `backend/src/app.js`.
  - Desligar no `backend/src/app.js` e nos routers as rotas fora do MVP (`/_proto`, painéis, MCP, materiais, grupos, ranking, assinatura, cupons, suporte, membros de pasta, apelação de publicação, guardian-requests).
  - Desligar no `frontend` a `<ProtoBar />`, as chamadas `/_proto/*`, os botões de login demo/social mockado e ocultar da navegação as telas fora do MVP, protegendo os componentes ativos para não chamarem rotas desligadas (`CommunityHome`, `CreatePage`, `NoaHub`, `StudentLayout`, `ProfileHome`, `WalletPage`, `DevicesPage`).
  - Criar as ADRs 0012 e 0013 e atualizar o status das ADRs 0001, 0008 e `docs/adr/README.md`.
- **Critério de pronto verificável:**
  - `GET /v1/_proto/state`, `GET /v1/mcp/connections`, `GET /v1/coupons`, `GET /v1/subscription` e `GET /v1/support/tickets` retornam `404`.
  - **Nenhuma tela do MVP quebra com rotas desligadas** (ex.: `CommunityHome` sem `/community/groups`, `CreatePage` e `NoaHub` sem `/mcp/connections`, `StudentLayout` sem `/mcp/requests` e `/mcp/inbox`, `WalletPage` sem `/coupons`, `ProfileHome` sem `/me/materials`, `DevicesPage` apenas com sessão atual e troca de senha).
  - `ProtoBar` e botão de login demo não aparecem na UI.
  - Cabeçalhos de segurança e limite de body (`100kb`) ativos; `npm test` (testes do núcleo) e `npm run build` compilam e passam sem erros.

### Etapa 2 — Migrations SQL Versionadas (Schema, Proteção de Colunas, Ledger, Rate Limit, Moderação Leve, RLS e Storage)
- **O que será feito:**
  - Criar os 8 arquivos SQL em `supabase/migrations/` + `supabase/full_migration.sql` cobrindo todas as tabelas, índices, constraints `CHECK (birth_date <= CURRENT_DATE - INTERVAL '18 years')` e `CHECK (balance_after >= 0)`, trigger `protect_profile_columns` em `profiles`, triggers de imutabilidade do ledger e auditoria, RPCs `append_neuron_ledger_entry`, `append_audit_entry` e `check_rate_limit`, view `v_moderation_queue`, políticas RLS (com `generation_daily_usage` e `noa_daily_budget` restritas a escrita apenas via `service_role`) e buckets de Storage.
- **Critério de pronto verificável:**
  - Execução limpa das migrations no banco Supabase (aplicadas manualmente por você no SQL Editor) sem erros de sintaxe ou dependência.
  - Teste confirmando que: (a) `UPDATE` ou `DELETE` em `neuron_ledger` falha com exceção; (b) `append_neuron_ledger_entry` impede saldo negativo; (c) com chave `anon` + JWT de usuário autenticado, tentar zerar cota (`generation_daily_usage` / `noa_daily_budget`) ou mudar `plan`/`public_profile` em `profiles` falha; (d) a view `v_moderation_queue` existe e responde.

### Etapa 3 — Clientes Supabase, Rate Limit e Fluxo de Auth Real (Convite + ≥ 18 anos no Servidor)
- **O que será feito:**
  - Instalar `@supabase/supabase-js` em `backend` e `frontend`.
  - Criar `backend/src/data/supabase.js`, `backend/src/data/profiles.repo.js`, `backend/src/data/audit.repo.js`, `backend/src/lib/rateLimit.js` e `frontend/src/lib/supabase.js`.
  - Atualizar `backend/src/lib/auth.js` (`requireRole` / `requireStudent`) para validar o JWT do Supabase e instanciar `req.db`.
  - Atualizar `backend/src/routes/auth.js` (`POST /v1/auth/register` exigindo `INVITE_CODE`, validando ≥ 18 anos e criando usuário via `service_role` com `email_confirm: true`; `POST /v1/auth/login` com rate limit) e as telas `LoginPage.jsx`, `RegisterPage.jsx` (com campo de senha e código de convite), `OnboardingPage.jsx` e `RecoverPage.jsx`.
- **Critério de pronto verificável:**
  - Tentativa de cadastro sem código de convite válido retorna `403 invalid_invite_code`; tentativa com `< 18 anos` retorna `422 under_age` no servidor.
  - Cadastro com convite válido e ≥ 18 anos cria usuário no Supabase Auth + linhas em `public.profiles`, `public.study_settings`, `public.user_consents` e `public.noa_daily_budget`.
  - Teste automatizado/verificação: com `anon` key + JWT de usuário, tentar mudar `plan` em `profiles` ou zerar cota falha.

### Etapa 4 — Camada de Dados: Perfil (`/me`), Consentimentos e Carteira/Ledger (`/wallet`)
- **O que será feito:**
  - Implementar `backend/src/data/ledger.repo.js` e `backend/src/data/mappers.js`.
  - Migrar `backend/src/routes/me.js` (`GET /me` com crédito diário idempotente `daily_access:<dayKey>` no ledger, `PATCH /me/settings`, `GET/PATCH /me/consents`, `POST /me/password`) e `backend/src/routes/wallet.js` (`GET /wallet`) para usar os repositórios no Supabase.
- **Critério de pronto verificável:**
  - `GET /v1/me` credita +1 Neurônio no primeiro acesso do dia em `neuron_ledger` e não duplica em chamadas subsequentes no mesmo dia.
  - Alterar configurações/meta diária em `/app/perfil/configuracoes` persiste no banco após recarregar a página.
  - `/app/carteira` exibe o saldo real e o extrato vindo de `public.neuron_ledger`.

### Etapa 5 — Migração de Decks, Pastas e Cards (`/decks`, `/folders`)
- **O que será feito:**
  - Implementar `backend/src/data/decks.repo.js`.
  - Migrar `backend/src/routes/decks.js` (listar decks/pastas/favoritos, criar deck, detalhe do deck, editar deck, excluir deck, criar/editar/excluir card, exportar deck, criar/editar/excluir pasta e mover deck de pasta).
- **Critério de pronto verificável:**
  - Criar pasta, criar deck, adicionar/editar/remover cards e fixar deck no `/app/decks` persistem no Postgres com RLS ativo (um usuário autenticado só vê seus próprios decks e cards).

### Etapa 6 — Migração do Loop de Estudo FSRS, Revisões e Objetivos (`/study`, `/objectives`)
- **O que será feito:**
  - Implementar `backend/src/data/study.repo.js`.
  - Migrar `backend/src/routes/study.js`: `GET /study/today`, `POST /reviews` (recalculando FSRS em `cards`, gravando em `reviews` com idempotência por `client_id`, atualizando streak e creditando +5 Neurônios de `goal_bonus` no ledger ao bater a meta do dia), `POST /study/complete`, `skip`, `undo-skip`, `pause`, `resume`, `goal`, `plan`, `fatigue`, `history`, `mistakes` e CRUD de `/objectives` + `/objectives/:id/outcome` (+5 Neurônios no ledger).
- **Critério de pronto verificável:**
  - Completar uma sessão de estudo atualiza `sched_*` nos cards no Postgres, incrementa `done_today` e `streak`, e credita `goal_bonus` no `neuron_ledger` ao atingir a meta.
  - Reenviar o mesmo `clientId` em `POST /v1/reviews` retorna em `duplicates` sem duplicar revisão nem FSRS.
  - Criar objetivo e registrar `outcome` persiste no banco e credita +5 Neurônios.

### Etapa 7A — Persistência de Jobs/Cotas de Geração, Nôa (Sugestões/Decisões) e Privacidade (Sem Timers)
- **O que será feito:**
  - Implementar `backend/src/data/generation.repo.js` e `backend/src/data/noa.repo.js`.
  - Remover `startTimeline` e `store.later` (`setTimeout`) de `backend/src/routes/generation.js` e `backend/src/store.js`.
  - Persistir `generation_jobs` e `generation_daily_usage` (escrita via `service_role`) no Postgres, com rate limit na rota de criação. Manter fallback determinístico **exclusivamente em ambiente de teste** atrás de flag explícita (`NODE_ENV === 'test' && process.env.ALLOW_DETERMINISTIC_AI_FALLBACK === 'true'`).
  - Migrar `backend/src/routes/noa.js` (catálogo, overview, responder sugestão e reverter decisão) e `backend/src/routes/privacy.js`.
- **Critério de pronto verificável:**
  - Nenhum `setTimeout`/`store.later` resta no fluxo de geração.
  - `generation_jobs`, `generation_daily_usage`, `noa_suggestions`, `noa_decisions` e ações de `/privacy/*` persistem no banco.
  - Fora de modo de teste com flag explícita, nenhuma geração usa cards mockados silenciosamente.

### Etapa 7B — Geração Real com Gemini Flash (Texto, Tema Digitado e PDF até 50 Páginas via Storage + Aviso de Privacidade)
- **Pré-requisito antes de implementar a 7B:**
  - Executar medição real de latência com um PDF de 50 páginas no Gemini Flash e apresentar o resultado para você decidir entre execução síncrona na requisição ou job com polling.
- **O que será feito:**
  - Implementar `backend/src/lib/gemini.js` consumindo Gemini Flash (`GEMINI_MODEL_GENERATION`) para: (a) texto colado, (b) tema digitado e (c) PDF de até 50 páginas enviado diretamente ao bucket `generation-uploads` do Supabase Storage.
  - Adicionar em `CreatePage.jsx` o aviso explícito de privacidade sobre o processamento do texto/PDF pelo provedor de IA (Gemini) e validação do limite de 50 páginas.
- **Critério de pronto verificável:**
  - Geração real de flashcards com Gemini Flash funcionando para texto colado, tema digitado e PDF de até 50 páginas via Supabase Storage, exibindo aviso de privacidade na UI e respeitando a cota diária.

### Etapa 7C — Chat da Nôa com Gemini Flash (`GET/POST /v1/noa/chat`) e UI em `NoaHub`
- **O que será feito:**
  - Implementar `GET /v1/noa/chat` e `POST /v1/noa/chat` em `backend/src/routes/noa.js` (com rate limit de IA, persistência em `public.noa_chat_messages` e controle de teto diário configurável via `NOA_DAILY_CHAT_LIMIT` em `public.noa_daily_budget` escrito por `service_role`).
  - Adicionar a aba/seção de Chat da Nôa em `frontend/src/features/noa/NoaHub.jsx` com strings em `frontend/src/i18n/pt-BR/noa.js`.
- **Critério de pronto verificável:**
  - Enviar mensagens no chat da Nôa em `/app/noa` responde via Gemini Flash, persiste o histórico em `noa_chat_messages` e bloqueia com erro amigável `429 daily_limit` ao atingir `NOA_DAILY_CHAT_LIMIT`.

### Etapa 8 — Migração da Comunidade de Decks com Moderação Leve (`/community`, `/public`) e Configuração Vercel
- **O que será feito:**
  - Implementar `backend/src/data/community.repo.js`.
  - Migrar `POST /v1/decks/:id/publish` (com rate limit, nascendo como `status = 'aprovado'`, `hidden_at = null`, com `snapshot` dos cards), `GET /v1/community/feed`, `GET /v1/community/search`, `GET /v1/community/decks/:id`, `favorite`, `clone` (com crédito `clone_bonus` ao autor se aplicável), `vote`, `react`, `share`, `report` (com rate limit, gravando em `moderation_reports`), `comments` (com rate limit), `like` e `GET /v1/public/decks/:publicId`.
  - Criar `api/index.js` e `vercel.json` para deploy unificado na Vercel.
- **Critério de pronto verificável:**
  - Publicar um deck o torna imediatamente visível no feed da comunidade para outro usuário autenticado.
  - Denunciar um deck ou comentário cria registro em `moderation_reports` e aparece na view `v_moderation_queue`.
  - Preencher `hidden_at` na publicação faz o deck desaparecer imediatamente do feed, da busca e do preview público.
  - Suite de testes do núcleo (`npm test`) e build de produção (`npm run build`) passando.

---

## 12. Perguntas para Decisão e Riscos Mapeados

### 12.1 Decisões Fechadas do Plano (Atualizado em 13/11/2026)

1. **Cadastro Fechado por Convite e Sem Confirmação de E-mail:**
   - **Decisão:** Signup público do Supabase Auth **desligado**. `POST /v1/auth/register` cria o usuário no servidor via `service_role` (`email_confirm: true`), valida idade ≥ 18 anos e exige código de convite (`INVITE_CODE`). O frontend não chama `signUp` diretamente.
2. **RLS de Cotas e Proteção por Coluna em `profiles`:**
   - **Decisão:** `generation_daily_usage` e `noa_daily_budget` só aceitam escrita via `service_role`. A tabela `profiles` possui trigger `protect_profile_columns` impedindo que `authenticated` altere `plan`, `role`, `email`, `birth_date`, `deactivated_at` ou `public_profile`. Incluído teste verificando que `anon` key + JWT de usuário falha ao tentar zerar cota ou mudar `plan`.
3. **Rate Limit, Cabeçalhos de Segurança, CORS Restrito e Limite de Body:**
   - **Decisão:** Implementação sem novas dependências npm: rate limit via tabela `public.rate_limits` + RPC `public.check_rate_limit` no Postgres para login/auth, IA, publicação e comentários/denúncias; middleware nativo de cabeçalhos de segurança; CORS restrito a `CORS_ALLOWED_ORIGIN`; e `express.json({ limit: '100kb' })`.
4. **Motor de IA (Gemini Flash) e Divisão da Etapa 7 em 7A, 7B e 7C:**
   - **Decisão:**
     - **7A:** Persistência de jobs e cotas sem timers (`setTimeout`/`store.later`); fallback determinístico restrito a testes atrás de flag explícita (`ALLOW_DETERMINISTIC_AI_FALLBACK=true`).
     - **7B:** Gemini Flash real para texto, tema digitado e PDF de até 50 páginas via upload direto ao Supabase Storage com aviso de privacidade. Antes de implementar a 7B, será feita uma medição de latência com PDF de 50 páginas para decidir entre execução síncrona e job com polling.
     - **7C:** Chat da Nôa (`GET/POST /v1/noa/chat`) com Gemini Flash, UI em `NoaHub.jsx` e teto diário configurável (`NOA_DAILY_CHAT_LIMIT`).
5. **Aplicação Manual de Migrations e Credenciais de Produção:**
   - **Decisão:** As migrations SQL versionadas (`supabase/migrations/*.sql` e `supabase/full_migration.sql`) são aplicadas manualmente por você no painel do Supabase; o agente nunca recebe credenciais de produção.
6. **Suporte (`/app/perfil/suporte`) e Dispositivos (`/app/perfil/dispositivos`):**
   - **Decisão:** Suporte desligado por flag (`supportTickets: false`); Dispositivos mantido apenas com a visualização da sessão atual e troca de senha (`POST /v1/me/password`).
7. **Dependência `@supabase/supabase-js` (Regra 7):**
   - **Decisão:** Aprovada a instalação de `@supabase/supabase-js` nos workspaces `backend` e `frontend` (na Etapa 3). None outra dependência externa necessária.

### 12.2 Riscos Mapeados e Mitigações
1. **Risco de Timeout na Vercel Serverless (limite de 10s–60s no plano Hobby) durante geração por IA:**
   - *Mitigação:* Limitar o tamanho do prompt e o número máximo de cards gerados por requisição (ex.: 15 a 25 cards objetivos por chamada) com `AbortController` de 25s para nunca estourar o timeout da função serverless sem dar resposta amigável ao aluno.
2. **Risco de Rate Limit do SMTP Embutido do Supabase (2 a 4 e-mails/hora):**
   - *Mitigação:* Adotar a Opção A (auto-confirm para os 5 testadores) ou configurar SMTP externo antes de enviar o link aos testadores.
3. **Risco de Quebra da Suite de Testes Existente (`backend/test/api.test.js` e `frontend/src/test/*.test.jsx`):**
   - *Mitigação:* Manter a assinatura dos repositórios em `backend/src/data/` desacoplada para que os testes do núcleo possam rodar tanto contra o adaptador de teste rápido quanto contra o Supabase, e atualizar os testes das rotas desligadas por flag para refletirem o escopo do MVP.
4. **Risco de Exposição de Dados Pessoais em Perfis de Autores da Comunidade:**
   - *Mitigação:* A policy de RLS de `public.profiles` permite `SELECT` apenas para `auth.uid() = id`. Nome e informações públicas do autor exibidos na comunidade ficam desnormalizados em `deck_publications` (`author_name`) ou expostos apenas por leitura controlada de `public_profile`, nunca expondo `email`, `phone` ou `birth_date` de outros usuários.

