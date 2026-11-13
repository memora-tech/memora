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

