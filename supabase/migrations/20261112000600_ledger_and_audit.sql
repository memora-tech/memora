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
