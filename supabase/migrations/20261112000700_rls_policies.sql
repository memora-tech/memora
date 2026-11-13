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

