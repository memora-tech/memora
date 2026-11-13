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
