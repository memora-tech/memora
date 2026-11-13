CREATE TABLE IF NOT EXISTS public.generation_daily_usage (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_key text NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day_key)
);

DROP TRIGGER IF EXISTS trg_generation_daily_usage_updated_at ON public.generation_daily_usage;
CREATE TRIGGER trg_generation_daily_usage_updated_at
BEFORE UPDATE ON public.generation_daily_usage
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id text PRIMARY KEY DEFAULT ('job_' || encode(gen_random_bytes(8), 'hex')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NULL,
  plan text NOT NULL DEFAULT 'free',
  source text NOT NULL CHECK (source IN ('camera', 'file', 'text', 'anki', 'empty')),
  document_name text NOT NULL,
  storage_path text NULL,
  text_preview text NOT NULL DEFAULT '',
  text_content text NULL,
  size_tokens integer NOT NULL DEFAULT 0,
  pages integer NOT NULL DEFAULT 1,
  legibility text NOT NULL DEFAULT 'ok',
  status text NOT NULL CHECK (status IN ('criado', 'acima_do_orcamento', 'na_fila', 'lendo', 'gerando', 'tentando_novamente', 'pronto', 'aprovado', 'falhou', 'cancelado')),
  scope jsonb NULL,
  over_budget jsonb NULL,
  tokens_budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  reader_model text NULL,
  generator_model text NULL,
  attempt integer NOT NULL DEFAULT 1,
  quota_refunded boolean NOT NULL DEFAULT false,
  result jsonb NULL,
  approved_deck_id text NULL REFERENCES public.decks(id) ON DELETE SET NULL,
  ready_at timestamptz NULL,
  failed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_gen_jobs_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_gen_jobs_user_created ON public.generation_jobs (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_generation_jobs_updated_at ON public.generation_jobs;
CREATE TRIGGER trg_generation_jobs_updated_at
BEFORE UPDATE ON public.generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.noa_daily_budget (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_key text NOT NULL,
  suggestions_used integer NOT NULL DEFAULT 0 CHECK (suggestions_used >= 0),
  suggestions_limit integer NOT NULL DEFAULT 5 CHECK (suggestions_limit >= 0),
  autonomous_used integer NOT NULL DEFAULT 0 CHECK (autonomous_used >= 0),
  autonomous_limit integer NOT NULL DEFAULT 1 CHECK (autonomous_limit >= 0),
  chat_used integer NOT NULL DEFAULT 0 CHECK (chat_used >= 0),
  chat_limit integer NOT NULL DEFAULT 20 CHECK (chat_limit >= 0),
  PRIMARY KEY (user_id, day_key)
);

CREATE TABLE IF NOT EXISTS public.noa_suggestions (
  id text PRIMARY KEY DEFAULT ('sug_' || encode(gen_random_bytes(8), 'hex')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  deck_id text NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'dispensada')),
  feedback text NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_noa_suggestions_user ON public.noa_suggestions (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.noa_decisions (
  id text PRIMARY KEY DEFAULT ('dec_' || encode(gen_random_bytes(8), 'hex')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  text text NOT NULL,
  reversible boolean NOT NULL DEFAULT true,
  reverted boolean NOT NULL DEFAULT false,
  reverted_at timestamptz NULL,
  accepted boolean NULL,
  previous_state jsonb NULL,
  contested jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_noa_decisions_user ON public.noa_decisions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.noa_chat_messages (
  id text PRIMARY KEY DEFAULT ('msg_' || encode(gen_random_bytes(8), 'hex')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL CHECK (char_length(trim(content)) >= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_noa_chat_user_created ON public.noa_chat_messages (user_id, created_at ASC);
