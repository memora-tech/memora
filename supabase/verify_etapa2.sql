CREATE OR REPLACE FUNCTION pg_temp.run_etapa2_verification()
RETURNS TABLE(check_id text, description text, passed boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-8000-000000000099';
  v_ledger public.neuron_ledger;
  v_queue_count integer;
  v_mod_result jsonb;
  v_caught boolean;
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
    VALUES (v_user_id, 'verificacao-etapa2@memora.local', '{"name":"Teste Etapa 2"}'::jsonb, now(), now());

    INSERT INTO public.profiles (id, name, email, birth_date, plan)
    VALUES (v_user_id, 'Teste Etapa 2', 'verificacao-etapa2@memora.local', '1995-05-10', 'free');

    v_ledger := public.append_neuron_ledger_entry(
      v_user_id,
      5,
      'goal_bonus',
      '{"day":"2026-11-13"}'::jsonb,
      'verify:goal:1'
    );
    IF v_ledger.balance_after <> 5 THEN
      RAISE EXCEPTION 'Falha no credito do ledger';
    END IF;

    v_caught := false;
    BEGIN
      UPDATE public.neuron_ledger SET amount = 999 WHERE id = v_ledger.id;
    EXCEPTION WHEN sqlstate '55000' THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'UPDATE em neuron_ledger deveria ter falhado com 55000';
    END IF;

    v_caught := false;
    BEGIN
      DELETE FROM public.neuron_ledger WHERE id = v_ledger.id;
    EXCEPTION WHEN sqlstate '55000' THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'DELETE em neuron_ledger deveria ter falhado com 55000';
    END IF;

    v_caught := false;
    BEGIN
      PERFORM public.append_neuron_ledger_entry(
        v_user_id,
        -10,
        'coupon_redeem',
        '{}'::jsonb,
        'verify:debit:1'
      );
    EXCEPTION WHEN sqlstate 'P0001' THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'Saldo negativo no ledger deveria ter falhado com P0001';
    END IF;

    INSERT INTO public.generation_daily_usage (user_id, day_key, used)
    VALUES (v_user_id, '2026-11-13', 3);

    INSERT INTO public.noa_daily_budget (user_id, day_key, chat_used)
    VALUES (v_user_id, '2026-11-13', 10);

    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', v_user_id::text, 'role', 'authenticated')::text,
      true
    );
    EXECUTE 'SET LOCAL ROLE authenticated';

    v_caught := false;
    BEGIN
      UPDATE public.generation_daily_usage SET used = 0 WHERE user_id = v_user_id;
    EXCEPTION WHEN insufficient_privilege THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'Zerar generation_daily_usage como authenticated deveria falhar';
    END IF;

    v_caught := false;
    BEGIN
      UPDATE public.noa_daily_budget SET chat_used = 0 WHERE user_id = v_user_id;
    EXCEPTION WHEN insufficient_privilege THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'Zerar noa_daily_budget como authenticated deveria falhar';
    END IF;

    v_caught := false;
    BEGIN
      UPDATE public.profiles SET plan = 'premium' WHERE id = v_user_id;
    EXCEPTION WHEN sqlstate '42501' THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'Mudar plan em profiles como authenticated deveria falhar com 42501';
    END IF;

    v_caught := false;
    BEGIN
      UPDATE public.profiles SET public_profile = '{"points":99999}'::jsonb WHERE id = v_user_id;
    EXCEPTION WHEN sqlstate '42501' THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'Mudar public_profile em profiles como authenticated deveria falhar com 42501';
    END IF;

    EXECUTE 'RESET ROLE';

    INSERT INTO public.decks (id, owner_id, name)
    VALUES ('d_verify_etapa2', v_user_id, 'Deck Verificacao');

    INSERT INTO public.deck_publications (
      id, deck_id, public_id, author_id, author_name, name, card_count, snapshot
    )
    VALUES (
      'pub_verify_etapa2',
      'd_verify_etapa2',
      'p-verify2',
      v_user_id,
      'Teste Etapa 2',
      'Deck Verificacao',
      1,
      '[{"id":"c1","front":"P","back":"R"}]'::jsonb
    );

    INSERT INTO public.moderation_reports (
      id, target_type, target_id, publication_id, target_name, reason, reporter_id
    )
    VALUES (
      'rep_verify_etapa2',
      'deck',
      'pub_verify_etapa2',
      'pub_verify_etapa2',
      'Deck Verificacao',
      'Conteúdo impróprio',
      v_user_id
    );

    SELECT COUNT(*) INTO v_queue_count
    FROM public.v_moderation_queue
    WHERE target_id = 'pub_verify_etapa2' AND open_reports_count = 1;

    IF v_queue_count <> 1 THEN
      RAISE EXCEPTION 'v_moderation_queue deveria listar a denuncia aberta';
    END IF;

    v_mod_result := public.moderate_hide_target('deck', 'pub_verify_etapa2', 'Teste de moderacao');
    IF (v_mod_result ->> 'resolvedReports')::integer <> 1 THEN
      RAISE EXCEPTION 'moderate_hide_target deveria resolver 1 denuncia';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_TEST_DATA' USING ERRCODE = 'P9999';
  EXCEPTION WHEN sqlstate 'P9999' THEN
    EXECUTE 'RESET ROLE';
  END;

  RETURN QUERY VALUES
    ('a', 'Ledger de Neuronios bloqueia UPDATE e DELETE com erro 55000', true),
    ('b', 'append_neuron_ledger_entry credita atomicamente e bloqueia saldo negativo (P0001)', true),
    ('c', 'Role authenticated (anon + JWT) falha ao zerar cota ou mudar plan/public_profile (42501)', true),
    ('d', 'View v_moderation_queue e funcao moderate_hide_target respondem e ocultam alvo', true);
END;
$$;

SELECT * FROM pg_temp.run_etapa2_verification();

