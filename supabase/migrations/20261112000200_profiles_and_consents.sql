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
