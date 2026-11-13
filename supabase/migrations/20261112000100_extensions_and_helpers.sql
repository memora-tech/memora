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

