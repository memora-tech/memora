CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_adult(p_birth_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_birth_date IS NOT NULL
     AND p_birth_date <= (CURRENT_DATE - INTERVAL '18 years')::date;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student' CHECK (role = 'student'),
  name text NOT NULL CHECK (char_length(trim(name)) >= 2),
  email text NOT NULL,
  phone text NULL,
  birth_date date NOT NULL CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years')),
  is_student boolean NOT NULL DEFAULT true,
  origin text NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  locale text NOT NULL DEFAULT 'pt-BR',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  onboarding_done boolean NOT NULL DEFAULT false,
  onboarding_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{"intensity":"padrao","reminderTime":"19:00","push":true,"quietWindow":{"start":"23:00","end":"07:30","learned":true,"lockedForMinor":false},"limits":{"whatsappPerDay":3,"pushPerDay":8},"sentToday":{"whatsapp":0,"push":0}}'::jsonb,
  public_profile jsonb NOT NULL DEFAULT '{"level":1,"topic":"Geral","points":0,"badges":[],"cardsGenerated":0,"bio":""}'::jsonb,
  deactivated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles (id) WHERE deactivated_at IS NULL;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'authenticated'
     OR (
       COALESCE(current_setting('request.jwt.claims', true), '') <> ''
       AND (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated'
     )
     OR session_user = 'authenticated'
     OR current_user = 'authenticated' THEN
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

DROP TRIGGER IF EXISTS trg_profiles_protect_columns ON public.profiles;
CREATE TRIGGER trg_profiles_protect_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_share boolean NOT NULL DEFAULT false,
  whatsapp jsonb NOT NULL DEFAULT '{"lembretes":true,"conquistas":false,"conta":true,"informativo":false}'::jsonb,
  content_policy_accepted_version text NULL,
  content_policy_accepted_at timestamptz NULL,
  privacy_policy_accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_user_consents_updated_at ON public.user_consents;
CREATE TRIGGER trg_user_consents_updated_at
BEFORE UPDATE ON public.user_consents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.study_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal integer NOT NULL DEFAULT 20 CHECK (goal >= 5 AND goal <= 200),
  goal_suggested integer NOT NULL DEFAULT 20,
  done_today integer NOT NULL DEFAULT 0 CHECK (done_today >= 0),
  day_key text NOT NULL,
  goal_hit_day text NULL,
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  study_days integer NOT NULL DEFAULT 0 CHECK (study_days >= 0),
  last_study_day text NULL,
  last_study_at timestamptz NULL,
  skipped_day text NULL,
  reschedules_week_key text NOT NULL,
  reschedules_used integer NOT NULL DEFAULT 0,
  reschedules_limit integer NOT NULL DEFAULT 3,
  paused_until timestamptz NULL,
  paused_at timestamptz NULL,
  fatigue_detection boolean NOT NULL DEFAULT true,
  fatigue_keep_load_day text NULL,
  plan_order text[] NOT NULL DEFAULT '{}',
  plan_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  community_answered jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_study_settings_updated_at ON public.study_settings;
CREATE TRIGGER trg_study_settings_updated_at
BEFORE UPDATE ON public.study_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.objectives (
  id text PRIMARY KEY DEFAULT ('obj_' || encode(gen_random_bytes(8), 'hex')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) >= 1),
  target_date date NOT NULL,
  subjects text[] NOT NULL DEFAULT '{}',
  priority boolean NOT NULL DEFAULT false,
  outcome text NULL CHECK (outcome IN ('aprovado', 'reprovado', 'aguardando', 'nao_fiz')),
  outcome_at timestamptz NULL,
  outcome_rewarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objectives_user_date ON public.objectives (user_id, target_date ASC);

CREATE TABLE IF NOT EXISTS public.folders (
  id text PRIMARY KEY DEFAULT ('f_' || encode(gen_random_bytes(8), 'hex')),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id text NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_owner ON public.folders (owner_id);

CREATE TABLE IF NOT EXISTS public.decks (
  id text PRIMARY KEY DEFAULT ('d_' || encode(gen_random_bytes(8), 'hex')),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id text NULL REFERENCES public.folders(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(trim(name)) >= 1),
  category_id text NOT NULL DEFAULT 'outros',
  tags text[] NOT NULL DEFAULT '{}',
  difficulty text NOT NULL DEFAULT 'medio' CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  lang text NOT NULL DEFAULT 'pt-BR',
  scheduled boolean NOT NULL DEFAULT true,
  difficult boolean NOT NULL DEFAULT false,
  focus boolean NOT NULL DEFAULT false,
  complementary boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  favorite boolean NOT NULL DEFAULT false,
  source jsonb NOT NULL DEFAULT '{"type":"vazio","document":null,"pages":null}'::jsonb,
  cloned_from jsonb NULL,
  publication_meta jsonb NOT NULL DEFAULT '{"status":"nao_publicado"}'::jsonb,
  last_studied_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_owner_active ON public.decks (owner_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_decks_folder ON public.decks (folder_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_decks_updated_at ON public.decks;
CREATE TRIGGER trg_decks_updated_at
BEFORE UPDATE ON public.decks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cards (
  id text PRIMARY KEY DEFAULT ('c_' || encode(gen_random_bytes(8), 'hex')),
  deck_id text NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio')),
  front text NOT NULL CHECK (char_length(trim(front)) >= 1),
  back text NOT NULL CHECK (char_length(trim(back)) >= 1),
  media jsonb NULL,
  lang text NOT NULL DEFAULT 'pt-BR',
  origin jsonb NOT NULL DEFAULT '{"document":"Criado manualmente"}'::jsonb,
  uncertain boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  sched_state text NOT NULL DEFAULT 'new' CHECK (sched_state IN ('new', 'learning', 'review', 'relearning')),
  sched_stability numeric(10,3) NOT NULL DEFAULT 0,
  sched_difficulty numeric(5,2) NOT NULL DEFAULT 5 CHECK (sched_difficulty >= 1 AND sched_difficulty <= 10),
  sched_due timestamptz NOT NULL DEFAULT now(),
  sched_last_review timestamptz NULL,
  sched_reps integer NOT NULL DEFAULT 0 CHECK (sched_reps >= 0),
  sched_lapses integer NOT NULL DEFAULT 0 CHECK (sched_lapses >= 0),
  sched_consecutive_lapses integer NOT NULL DEFAULT 0 CHECK (sched_consecutive_lapses >= 0),
  edited_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_pos ON public.cards (deck_id, position) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_owner_due ON public.cards (owner_id, sched_due) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_owner_lapses ON public.cards (owner_id, sched_lapses DESC) WHERE deleted_at IS NULL AND sched_lapses > 0;

CREATE TABLE IF NOT EXISTS public.reviews (
  id text PRIMARY KEY DEFAULT ('rev_' || encode(gen_random_bytes(8), 'hex')),
  client_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id text NULL REFERENCES public.cards(id) ON DELETE SET NULL,
  community_card_ref text NULL,
  deck_id text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  duration_ms integer NULL CHECK (duration_ms IS NULL OR duration_ms >= 0),
  offline boolean NOT NULL DEFAULT false,
  plausible boolean NOT NULL DEFAULT true,
  reviewed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reviews_user_client UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_reviewed ON public.reviews (user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_deck ON public.reviews (user_id, deck_id, reviewed_at DESC);

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

CREATE TABLE IF NOT EXISTS public.deck_publications (
  id text PRIMARY KEY DEFAULT ('pub_' || encode(gen_random_bytes(8), 'hex')),
  deck_id text NOT NULL UNIQUE REFERENCES public.decks(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE DEFAULT ('p-' || encode(gen_random_bytes(6), 'hex')),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category_id text NOT NULL DEFAULT 'outros',
  difficulty text NOT NULL DEFAULT 'medio' CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  lang text NOT NULL DEFAULT 'pt-BR',
  tags text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  card_count integer NOT NULL DEFAULT 1 CHECK (card_count >= 1),
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'aprovado' CHECK (status IN ('aprovado', 'rejeitado', 'despublicado')),
  hidden_at timestamptz NULL,
  hidden_reason text NULL,
  stats jsonb NOT NULL DEFAULT '{"studiedWeek":0,"votes":0,"favorites":0,"comments":0,"clones":0}'::jsonb,
  reactions jsonb NOT NULL DEFAULT '{"👏":0,"🔥":0,"🧠":0,"💡":0,"❤️":0,"😂":0}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_visible_feed ON public.deck_publications (published_at DESC) WHERE status = 'aprovado' AND hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pub_visible_category ON public.deck_publications (category_id, published_at DESC) WHERE status = 'aprovado' AND hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pub_author ON public.deck_publications (author_id);

DROP TRIGGER IF EXISTS trg_deck_publications_updated_at ON public.deck_publications;
CREATE TRIGGER trg_deck_publications_updated_at
BEFORE UPDATE ON public.deck_publications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.deck_comments (
  id text PRIMARY KEY DEFAULT ('cm_' || encode(gen_random_bytes(8), 'hex')),
  publication_id text NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE,
  parent_id text NULL REFERENCES public.deck_comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  text text NOT NULL CHECK (char_length(trim(text)) BETWEEN 1 AND 2000),
  hidden_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_pub_visible ON public.deck_comments (publication_id, created_at DESC) WHERE hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.deck_comments (parent_id);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id text NOT NULL REFERENCES public.deck_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.deck_reactions (
  publication_id text NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👏', '🔥', '🧠', '💡', '❤️', '😂')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.deck_favorites (
  publication_id text NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id text NULL REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_favorites_user ON public.deck_favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deck_votes (
  publication_id text NOT NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.author_follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, author_id)
);

CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id text PRIMARY KEY DEFAULT ('rep_' || encode(gen_random_bytes(8), 'hex')),
  target_type text NOT NULL CHECK (target_type IN ('deck', 'comment')),
  target_id text NOT NULL,
  publication_id text NULL REFERENCES public.deck_publications(id) ON DELETE CASCADE,
  comment_id text NULL REFERENCES public.deck_comments(id) ON DELETE CASCADE,
  target_name text NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 2),
  detail text NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'mantida', 'oculta')),
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_open ON public.moderation_reports (status, created_at DESC) WHERE status = 'aberta';
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.moderation_reports (target_type, target_id);

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

CREATE OR REPLACE FUNCTION public.moderate_hide_target(
  p_target_type text,
  p_target_id text,
  p_reason text DEFAULT 'Ocultado pela moderação'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_resolved integer := 0;
BEGIN
  IF p_target_type = 'deck' THEN
    UPDATE public.deck_publications
    SET hidden_at = v_now,
        hidden_reason = p_reason,
        updated_at = v_now
    WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    UPDATE public.deck_comments
    SET hidden_at = v_now
    WHERE id = p_target_id;
  ELSE
    RAISE EXCEPTION 'invalid_target_type' USING ERRCODE = '22023';
  END IF;

  UPDATE public.moderation_reports
  SET status = 'oculta',
      resolved_at = v_now
  WHERE target_type = p_target_type
    AND target_id = p_target_id
    AND status = 'aberta';

  GET DIAGNOSTICS v_resolved = ROW_COUNT;

  RETURN JSONB_BUILD_OBJECT(
    'targetType', p_target_type,
    'targetId', p_target_id,
    'hiddenAt', v_now,
    'resolvedReports', v_resolved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_hide_target(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_hide_target(text, text, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.neuron_ledger (
  id text PRIMARY KEY DEFAULT ('led_' || encode(gen_random_bytes(8), 'hex')),
  seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  type text NOT NULL CHECK (type IN ('daily_access', 'goal_bonus', 'objective_outcome', 'clone_bonus', 'referral_bonus', 'coupon_redeem', 'coupon_expired_refund')),
  idempotency_key text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ledger_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_seq ON public.neuron_ledger (user_id, seq DESC);

CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'neuron_ledger is append-only: % is not allowed', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_neuron_ledger_immutable ON public.neuron_ledger;
CREATE TRIGGER trg_neuron_ledger_immutable
BEFORE UPDATE OR DELETE ON public.neuron_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

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
    WHERE user_id = p_user_id
      AND idempotency_key = p_idempotency_key
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

CREATE TABLE IF NOT EXISTS public.audit_log (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_target ON public.audit_log (target, seq DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_log (actor, seq DESC);

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE OR REPLACE FUNCTION public.append_audit_entry(
  p_actor text,
  p_actor_role text,
  p_action text,
  p_target text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS public.audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_hash text;
  v_now timestamptz := now();
  v_hash text;
  v_entry public.audit_log;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('memora_audit_log'));

  SELECT COALESCE(
    (SELECT hash FROM public.audit_log ORDER BY seq DESC LIMIT 1),
    'GENESIS'
  ) INTO v_prev_hash;

  v_hash := encode(
    digest(
      concat_ws(
        '|',
        v_prev_hash,
        p_actor,
        p_actor_role,
        p_action,
        p_target,
        COALESCE(p_details, '{}'::jsonb)::text,
        v_now::text
      ),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.audit_log (actor, actor_role, action, target, details, prev_hash, hash, created_at)
  VALUES (p_actor, p_actor_role, p_action, p_target, COALESCE(p_details, '{}'::jsonb), v_prev_hash, v_hash, v_now)
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.append_audit_entry(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_audit_entry(text, text, text, text, jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_window_seconds <= 0 OR p_limit <= 0 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters' USING ERRCODE = '22023';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limits (key, window_start, count, updated_at)
  VALUES (p_key, v_window_start, 1, now())
  ON CONFLICT (key, window_start)
  DO UPDATE SET
    count = public.rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;

  RETURN JSONB_BUILD_OBJECT(
    'allowed', (v_count <= p_limit),
    'count', v_count,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_count),
    'resetAt', (v_window_start + make_interval(secs => p_window_seconds))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_scope text,
  p_actor_key text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_rate_limit(p_scope || ':' || p_actor_key, p_max_hits, p_window_seconds);
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards FORCE ROW LEVEL SECURITY;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE public.study_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives FORCE ROW LEVEL SECURITY;

ALTER TABLE public.generation_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_daily_usage FORCE ROW LEVEL SECURITY;

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.deck_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_publications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.deck_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_comments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.deck_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_reactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.deck_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_favorites FORCE ROW LEVEL SECURITY;

ALTER TABLE public.deck_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_votes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.author_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_follows FORCE ROW LEVEL SECURITY;

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE public.noa_daily_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noa_daily_budget FORCE ROW LEVEL SECURITY;

ALTER TABLE public.noa_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noa_suggestions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.noa_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noa_decisions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.noa_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noa_chat_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.neuron_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neuron_ledger FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON public.v_moderation_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_moderation_queue TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.generation_daily_usage FROM anon, authenticated;
GRANT SELECT ON public.generation_daily_usage TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.noa_daily_budget FROM anon, authenticated;
GRANT SELECT ON public.noa_daily_budget TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.neuron_ledger FROM anon, authenticated;
GRANT SELECT ON public.neuron_ledger TO authenticated;

REVOKE ALL ON public.audit_log FROM anon, authenticated;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_service_all ON public.profiles;
CREATE POLICY profiles_service_all ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS user_consents_service_all ON public.user_consents;
CREATE POLICY user_consents_service_all ON public.user_consents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_consents_select_own ON public.user_consents;
CREATE POLICY user_consents_select_own ON public.user_consents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_insert_own ON public.user_consents;
CREATE POLICY user_consents_insert_own ON public.user_consents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_update_own ON public.user_consents;
CREATE POLICY user_consents_update_own ON public.user_consents
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS folders_service_all ON public.folders;
CREATE POLICY folders_service_all ON public.folders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS folders_own_all ON public.folders;
CREATE POLICY folders_own_all ON public.folders
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS decks_service_all ON public.decks;
CREATE POLICY decks_service_all ON public.decks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS decks_own_all ON public.decks;
CREATE POLICY decks_own_all ON public.decks
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS cards_service_all ON public.cards;
CREATE POLICY cards_service_all ON public.cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cards_own_all ON public.cards;
CREATE POLICY cards_own_all ON public.cards
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS reviews_service_all ON public.reviews;
CREATE POLICY reviews_service_all ON public.reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS reviews_select_own ON public.reviews;
CREATE POLICY reviews_select_own ON public.reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
CREATE POLICY reviews_insert_own ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS study_settings_service_all ON public.study_settings;
CREATE POLICY study_settings_service_all ON public.study_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS study_settings_select_own ON public.study_settings;
CREATE POLICY study_settings_select_own ON public.study_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS study_settings_insert_own ON public.study_settings;
CREATE POLICY study_settings_insert_own ON public.study_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS study_settings_update_own ON public.study_settings;
CREATE POLICY study_settings_update_own ON public.study_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS objectives_service_all ON public.objectives;
CREATE POLICY objectives_service_all ON public.objectives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS objectives_own_all ON public.objectives;
CREATE POLICY objectives_own_all ON public.objectives
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS generation_daily_usage_service_all ON public.generation_daily_usage;
CREATE POLICY generation_daily_usage_service_all ON public.generation_daily_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS generation_daily_usage_select_own ON public.generation_daily_usage;
CREATE POLICY generation_daily_usage_select_own ON public.generation_daily_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS generation_jobs_service_all ON public.generation_jobs;
CREATE POLICY generation_jobs_service_all ON public.generation_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS generation_jobs_select_own ON public.generation_jobs;
CREATE POLICY generation_jobs_select_own ON public.generation_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS generation_jobs_insert_own ON public.generation_jobs;
CREATE POLICY generation_jobs_insert_own ON public.generation_jobs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS generation_jobs_update_own ON public.generation_jobs;
CREATE POLICY generation_jobs_update_own ON public.generation_jobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deck_publications_service_all ON public.deck_publications;
CREATE POLICY deck_publications_service_all ON public.deck_publications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS deck_publications_select_visible_or_own ON public.deck_publications;
CREATE POLICY deck_publications_select_visible_or_own ON public.deck_publications
  FOR SELECT TO authenticated
  USING ((status = 'aprovado' AND hidden_at IS NULL) OR auth.uid() = author_id);

DROP POLICY IF EXISTS deck_publications_insert_own ON public.deck_publications;
CREATE POLICY deck_publications_insert_own ON public.deck_publications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND hidden_at IS NULL);

DROP POLICY IF EXISTS deck_publications_update_own ON public.deck_publications;
CREATE POLICY deck_publications_update_own ON public.deck_publications
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id AND hidden_at IS NULL)
  WITH CHECK (auth.uid() = author_id AND hidden_at IS NULL);

DROP POLICY IF EXISTS deck_publications_delete_own ON public.deck_publications;
CREATE POLICY deck_publications_delete_own ON public.deck_publications
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS deck_comments_service_all ON public.deck_comments;
CREATE POLICY deck_comments_service_all ON public.deck_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS deck_comments_select_visible_or_own ON public.deck_comments;
CREATE POLICY deck_comments_select_visible_or_own ON public.deck_comments
  FOR SELECT TO authenticated
  USING (
    (
      hidden_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.deck_publications p
        WHERE p.id = deck_comments.publication_id
          AND p.status = 'aprovado'
          AND p.hidden_at IS NULL
      )
    )
    OR auth.uid() = author_id
  );

DROP POLICY IF EXISTS deck_comments_insert_own ON public.deck_comments;
CREATE POLICY deck_comments_insert_own ON public.deck_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND hidden_at IS NULL);

DROP POLICY IF EXISTS deck_comments_delete_own ON public.deck_comments;
CREATE POLICY deck_comments_delete_own ON public.deck_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS comment_likes_service_all ON public.comment_likes;
CREATE POLICY comment_likes_service_all ON public.comment_likes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS comment_likes_select_authenticated ON public.comment_likes;
CREATE POLICY comment_likes_select_authenticated ON public.comment_likes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS comment_likes_insert_own ON public.comment_likes;
CREATE POLICY comment_likes_insert_own ON public.comment_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS comment_likes_delete_own ON public.comment_likes;
CREATE POLICY comment_likes_delete_own ON public.comment_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS deck_reactions_service_all ON public.deck_reactions;
CREATE POLICY deck_reactions_service_all ON public.deck_reactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS deck_reactions_select_authenticated ON public.deck_reactions;
CREATE POLICY deck_reactions_select_authenticated ON public.deck_reactions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS deck_reactions_insert_own ON public.deck_reactions;
CREATE POLICY deck_reactions_insert_own ON public.deck_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deck_reactions_delete_own ON public.deck_reactions;
CREATE POLICY deck_reactions_delete_own ON public.deck_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS deck_favorites_service_all ON public.deck_favorites;
CREATE POLICY deck_favorites_service_all ON public.deck_favorites
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS deck_favorites_own_all ON public.deck_favorites;
CREATE POLICY deck_favorites_own_all ON public.deck_favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deck_votes_service_all ON public.deck_votes;
CREATE POLICY deck_votes_service_all ON public.deck_votes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS deck_votes_select_authenticated ON public.deck_votes;
CREATE POLICY deck_votes_select_authenticated ON public.deck_votes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS deck_votes_insert_own ON public.deck_votes;
CREATE POLICY deck_votes_insert_own ON public.deck_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deck_votes_delete_own ON public.deck_votes;
CREATE POLICY deck_votes_delete_own ON public.deck_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS author_follows_service_all ON public.author_follows;
CREATE POLICY author_follows_service_all ON public.author_follows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS author_follows_select_authenticated ON public.author_follows;
CREATE POLICY author_follows_select_authenticated ON public.author_follows
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS author_follows_insert_own ON public.author_follows;
CREATE POLICY author_follows_insert_own ON public.author_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS author_follows_delete_own ON public.author_follows;
CREATE POLICY author_follows_delete_own ON public.author_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS moderation_reports_service_all ON public.moderation_reports;
CREATE POLICY moderation_reports_service_all ON public.moderation_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS moderation_reports_select_own ON public.moderation_reports;
CREATE POLICY moderation_reports_select_own ON public.moderation_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS moderation_reports_insert_own ON public.moderation_reports;
CREATE POLICY moderation_reports_insert_own ON public.moderation_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS noa_daily_budget_service_all ON public.noa_daily_budget;
CREATE POLICY noa_daily_budget_service_all ON public.noa_daily_budget
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS noa_daily_budget_select_own ON public.noa_daily_budget;
CREATE POLICY noa_daily_budget_select_own ON public.noa_daily_budget
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_suggestions_service_all ON public.noa_suggestions;
CREATE POLICY noa_suggestions_service_all ON public.noa_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS noa_suggestions_select_own ON public.noa_suggestions;
CREATE POLICY noa_suggestions_select_own ON public.noa_suggestions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_suggestions_insert_own ON public.noa_suggestions;
CREATE POLICY noa_suggestions_insert_own ON public.noa_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_suggestions_update_own ON public.noa_suggestions;
CREATE POLICY noa_suggestions_update_own ON public.noa_suggestions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_decisions_service_all ON public.noa_decisions;
CREATE POLICY noa_decisions_service_all ON public.noa_decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS noa_decisions_select_own ON public.noa_decisions;
CREATE POLICY noa_decisions_select_own ON public.noa_decisions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_decisions_insert_own ON public.noa_decisions;
CREATE POLICY noa_decisions_insert_own ON public.noa_decisions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_decisions_update_own ON public.noa_decisions;
CREATE POLICY noa_decisions_update_own ON public.noa_decisions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_chat_messages_service_all ON public.noa_chat_messages;
CREATE POLICY noa_chat_messages_service_all ON public.noa_chat_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS noa_chat_messages_select_own ON public.noa_chat_messages;
CREATE POLICY noa_chat_messages_select_own ON public.noa_chat_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS noa_chat_messages_insert_own ON public.noa_chat_messages;
CREATE POLICY noa_chat_messages_insert_own ON public.noa_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS neuron_ledger_service_all ON public.neuron_ledger;
CREATE POLICY neuron_ledger_service_all ON public.neuron_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS neuron_ledger_select_own ON public.neuron_ledger;
CREATE POLICY neuron_ledger_select_own ON public.neuron_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS audit_log_service_all ON public.audit_log;
CREATE POLICY audit_log_service_all ON public.audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rate_limits_service_all ON public.rate_limits;
CREATE POLICY rate_limits_service_all ON public.rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'card-media',
    'card-media',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/webm', 'audio/ogg']
  ),
  (
    'generation-uploads',
    'generation-uploads',
    false,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS card_media_select_own ON storage.objects;
CREATE POLICY card_media_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'card-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS card_media_insert_own ON storage.objects;
CREATE POLICY card_media_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'card-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS card_media_delete_own ON storage.objects;
CREATE POLICY card_media_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'card-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS generation_uploads_select_own ON storage.objects;
CREATE POLICY generation_uploads_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'generation-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS generation_uploads_insert_own ON storage.objects;
CREATE POLICY generation_uploads_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generation-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS generation_uploads_delete_own ON storage.objects;
CREATE POLICY generation_uploads_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'generation-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
