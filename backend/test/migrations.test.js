import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { verifyDistDirectory } from '../../scripts/verify-dist-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const migrationsDir = path.join(rootDir, 'supabase', 'migrations')
const fullMigrationPath = path.join(rootDir, 'supabase', 'full_migration.sql')
const verifyScriptPath = path.join(rootDir, 'supabase', 'verify_etapa2.sql')

const EXPECTED_MIGRATIONS = [
  '20261112000100_extensions_and_helpers.sql',
  '20261112000200_profiles_and_consents.sql',
  '20261112000300_decks_cards_reviews.sql',
  '20261112000400_generation_and_noa.sql',
  '20261112000500_community_and_moderation.sql',
  '20261112000600_ledger_and_audit.sql',
  '20261112000700_rls_policies.sql',
  '20261112000800_storage_buckets.sql'
]

const EXPECTED_TABLES = [
  'profiles',
  'user_consents',
  'folders',
  'decks',
  'cards',
  'reviews',
  'study_settings',
  'objectives',
  'generation_daily_usage',
  'generation_jobs',
  'deck_publications',
  'deck_comments',
  'comment_likes',
  'deck_reactions',
  'deck_favorites',
  'deck_votes',
  'author_follows',
  'moderation_reports',
  'noa_daily_budget',
  'noa_suggestions',
  'noa_decisions',
  'noa_chat_messages',
  'neuron_ledger',
  'audit_log',
  'rate_limits'
]

describe('etapa 2: migrations SQL, RLS, ledger, protecao de colunas e moderacao', () => {
  it('mantem as 8 migrations versionadas sincronizadas com full_migration.sql', () => {
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
    expect(files).toEqual(EXPECTED_MIGRATIONS)

    const concatenated = files
      .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8').trim())
      .join('\n\n') + '\n'
    const fullContent = fs.readFileSync(fullMigrationPath, 'utf8')
    expect(fullContent).toBe(concatenated)
  })

  it('cria todas as 25 tabelas do MVP com ENABLE e FORCE ROW LEVEL SECURITY', () => {
    const fullSql = fs.readFileSync(fullMigrationPath, 'utf8')
    for (const table of EXPECTED_TABLES) {
      expect(fullSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(fullSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
      expect(fullSql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`)
    }
  })

  it('garante ledger imutavel (sem UPDATE/DELETE) e RPC atomica sem saldo negativo', () => {
    const ledgerSql = fs.readFileSync(
      path.join(migrationsDir, '20261112000600_ledger_and_audit.sql'),
      'utf8'
    )
    expect(ledgerSql).toContain('balance_after integer NOT NULL CHECK (balance_after >= 0)')
    expect(ledgerSql).toContain('BEFORE UPDATE OR DELETE ON public.neuron_ledger')
    expect(ledgerSql).toContain("RAISE EXCEPTION 'neuron_ledger is append-only: % is not allowed'")
    expect(ledgerSql).toContain("IF v_balance_after < 0 THEN")
    expect(ledgerSql).toContain("RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001'")
    expect(ledgerSql).toContain(
      'REVOKE ALL ON FUNCTION public.append_neuron_ledger_entry(uuid, integer, text, jsonb, text) FROM PUBLIC, anon, authenticated;'
    )
    expect(ledgerSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.append_neuron_ledger_entry(uuid, integer, text, jsonb, text) TO service_role;'
    )
  })

  it('bloqueia escrita de authenticated em generation_daily_usage e noa_daily_budget e protege colunas de profiles', () => {
    const profilesSql = fs.readFileSync(
      path.join(migrationsDir, '20261112000200_profiles_and_consents.sql'),
      'utf8'
    )
    const rlsSql = fs.readFileSync(
      path.join(migrationsDir, '20261112000700_rls_policies.sql'),
      'utf8'
    )

    expect(profilesSql).toContain("birth_date date NOT NULL CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'))")
    expect(profilesSql).toContain('CREATE OR REPLACE FUNCTION public.protect_profile_columns()')
    expect(profilesSql).toContain('NEW.plan IS DISTINCT FROM OLD.plan')
    expect(profilesSql).toContain('NEW.role IS DISTINCT FROM OLD.role')
    expect(profilesSql).toContain('NEW.email IS DISTINCT FROM OLD.email')
    expect(profilesSql).toContain('NEW.birth_date IS DISTINCT FROM OLD.birth_date')
    expect(profilesSql).toContain('NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at')
    expect(profilesSql).toContain('NEW.public_profile IS DISTINCT FROM OLD.public_profile')
    expect(profilesSql).toContain("RAISE EXCEPTION 'protected_profile_column_modification_forbidden'")

    expect(rlsSql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.generation_daily_usage FROM anon, authenticated;')
    expect(rlsSql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.noa_daily_budget FROM anon, authenticated;')
    expect(rlsSql).toContain('CREATE POLICY generation_daily_usage_select_own ON public.generation_daily_usage\n  FOR SELECT TO authenticated')
    expect(rlsSql).toContain('CREATE POLICY noa_daily_budget_select_own ON public.noa_daily_budget\n  FOR SELECT TO authenticated')
    expect(rlsSql).not.toMatch(
      /CREATE POLICY [^;]*ON public\.generation_daily_usage[^;]*FOR (INSERT|UPDATE|DELETE|ALL) TO authenticated/
    )
    expect(rlsSql).not.toMatch(
      /CREATE POLICY [^;]*ON public\.noa_daily_budget[^;]*FOR (INSERT|UPDATE|DELETE|ALL) TO authenticated/
    )
  })

  it('define view v_moderation_queue, moderate_hide_target, check_rate_limit, buckets de storage e script de verificacao', () => {
    const communitySql = fs.readFileSync(
      path.join(migrationsDir, '20261112000500_community_and_moderation.sql'),
      'utf8'
    )
    const storageSql = fs.readFileSync(
      path.join(migrationsDir, '20261112000800_storage_buckets.sql'),
      'utf8'
    )
    const verifySql = fs.readFileSync(verifyScriptPath, 'utf8')

    expect(communitySql).toContain('CREATE OR REPLACE VIEW public.v_moderation_queue AS')
    expect(communitySql).toContain('CREATE OR REPLACE FUNCTION public.moderate_hide_target(')
    expect(storageSql).toContain("'card-media'")
    expect(storageSql).toContain("'generation-uploads'")
    expect(verifySql).toContain('pg_temp.run_etapa2_verification()')
    expect(verifySql).toContain('SET LOCAL ROLE authenticated')
  })

  it('falha no verificador de bundle se qualquer variavel sem prefixo VITE_ aparecer em dist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memora-dist-test-'))
    try {
      const cleanFile = path.join(tmpDir, 'clean.js')
      fs.writeFileSync(cleanFile, 'console.log("bundle limpo")\n')
      expect(() => verifyDistDirectory(tmpDir, rootDir)).not.toThrow()

      const leakedFile = path.join(tmpDir, 'leaked.js')
      fs.writeFileSync(leakedFile, 'const key = "SUPABASE_SECRET_KEY"\n')
      expect(() => verifyDistDirectory(tmpDir, rootDir)).toThrow(/SUPABASE_SECRET_KEY/)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
