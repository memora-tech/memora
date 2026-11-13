import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createStore } from '../src/store.js'
import { verifyChain } from '../src/lib/audit.js'

const ALL_FEATURES = {
  proto: true,
  mcp: true,
  materials: true,
  studyGroups: true,
  rankings: true,
  coupons: true,
  subscriptions: true,
  supportTickets: true,
  panels: true,
  guardian: true,
  ageVerification: true,
  phoneVerification: true,
  folderSharing: true,
  publicationAppeals: true,
  deviceSessionsManagement: true
}

let store
let app

async function login(role = 'student', targetApp = app) {
  if (role === 'student') {
    const res = await request(targetApp).post('/v1/auth/login').send({ provider: 'email', email: 'manoel@exemplo.com', password: 'senha-segura' })
    return res.body.token
  }
  if (role === 'guardian') return (await request(targetApp).post('/v1/parental/auth/login').send({ email: 'p@x.com', password: 'x' })).body.token
  if (role === 'partner') return (await request(targetApp).post('/v1/partner/auth/login').send({ cnpj: '12.345.678/0001-90', password: 'x' })).body.token
  if (role.startsWith('admin:')) return (await request(targetApp).post('/v1/admin/auth/login').send({ role: role.split(':')[1] })).body.token
  if (role.startsWith('b2b:')) return (await request(targetApp).post('/v1/b2b/auth/login').send({ role: role.split(':')[1] })).body.token
  throw new Error('role')
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeEach(() => {
  store = createStore()
  app = createApp(store)
})

describe('etapa 1: endurecimento HTTP e rotas fora do escopo desligadas', () => {
  it('inclui cabeçalhos de segurança e rejeita login demo ou sem senha', async () => {
    const health = await request(app).get('/v1/health')
    expect(health.status).toBe(200)
    expect(health.headers['x-content-type-options']).toBe('nosniff')
    expect(health.headers['x-frame-options']).toBe('DENY')
    expect(health.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')

    const demo = await request(app).post('/v1/auth/login').send({ provider: 'demo' })
    expect(demo.status).toBe(422)
    expect(demo.body.code).toBe('invalid_credentials')

    const social = await request(app).post('/v1/auth/login').send({ provider: 'google' })
    expect(social.status).toBe(422)
  })

  it('responde 404 para todas as rotas desligadas por feature flag no MVP', async () => {
    const token = await login()
    const disabledGet = [
      '/v1/_proto/state',
      '/v1/mcp/connections',
      '/v1/mcp/requests',
      '/v1/mcp/inbox',
      '/v1/coupons',
      '/v1/subscription',
      '/v1/support/tickets',
      '/v1/parental/overview',
      '/v1/b2b/overview',
      '/v1/admin/moderation/queue',
      '/v1/partner/overview',
      '/v1/community/groups',
      '/v1/community/rankings',
      '/v1/me/materials',
      '/v1/me/publications',
      '/v1/me/guardian-requests'
    ]
    for (const url of disabledGet) {
      const res = await request(app).get(url).set(auth(token))
      expect(res.status, `GET ${url} deveria retornar 404`).toBe(404)
    }

    const disabledPost = [
      '/v1/_proto/reset',
      '/v1/auth/age-verification',
      '/v1/folders/f1/members',
      '/v1/publications/pub2/appeal'
    ]
    for (const url of disabledPost) {
      const res = await request(app).post(url).set(auth(token)).send({})
      expect(res.status, `POST ${url} deveria retornar 404`).toBe(404)
    }
  })

  it('rejeita payload JSON acima de 100kb com 413', async () => {
    const huge = 'x'.repeat(110 * 1024)
    const res = await request(app).post('/v1/auth/login').send({ email: 'a@b.co', password: huge })
    expect(res.status).toBe(413)
  })
})

describe('conta e acesso', () => {
  it('login devolve token e usuário verificado', async () => {
    const res = await request(app).post('/v1/auth/login').send({ provider: 'email', email: 'manoel@exemplo.com', password: 'senha-segura' })
    expect(res.status).toBe(200)
    expect(res.body.user.canEarn).toBe(true)
  })

  it('primeira abertura do dia credita 1 Neurônio e a segunda não', async () => {
    const token = await login()
    const first = await request(app).get('/v1/me').set(auth(token))
    expect(first.body.dailyCredit).toBeTruthy()
    expect(first.body.user.balance).toBe(149)
    const second = await request(app).get('/v1/me').set(auth(token))
    expect(second.body.dailyCredit).toBeNull()
    expect(second.body.user.balance).toBe(149)
  })

  it('cadastro bloqueia após 5 contas por IP em 24 h', async () => {
    const body = {
      name: 'Teste',
      email: 'a@b.co',
      password: 'senha-segura-123',
      inviteCode: 'MEMORA-MVP-2026',
      phone: '11999990000',
      birthDate: '2000-01-01',
      student: true
    }
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/v1/auth/register').send(body)
      expect(res.status).toBe(201)
    }
    const blocked = await request(app).post('/v1/auth/register').send(body)
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('captcha_required')
  })

  it('etapa 3: exige código de convite válido (403) e idade >= 18 anos (422) no servidor', async () => {
    const badInvite = await request(app).post('/v1/auth/register').send({
      name: 'Teste Sem Convite',
      email: 'semconvite@exemplo.com',
      password: 'senha-segura-123',
      inviteCode: 'CONVITE-ERRADO',
      birthDate: '1998-05-10',
      student: true
    })
    expect(badInvite.status).toBe(403)
    expect(badInvite.body.code).toBe('invalid_invite_code')

    const underAge = await request(app).post('/v1/auth/register').send({
      name: 'Menor de Idade',
      email: 'menor@exemplo.com',
      password: 'senha-segura-123',
      inviteCode: 'MEMORA-MVP-2026',
      birthDate: '2012-08-15',
      student: true
    })
    expect(underAge.status).toBe(422)
    expect(underAge.body.code).toBe('under_age')
  })

  it('etapa 3: provisiona conta via Supabase Auth (service_role) e valida JWT no requireStudent', async () => {
    const provisionedTables = {
      profiles: [],
      user_consents: [],
      study_settings: [],
      noa_daily_budget: []
    }
    const fakeUserId = '11111111-2222-4333-8444-555555555555'
    const fakeServiceClient = {
      auth: {
        admin: {
          async createUser({ email, user_metadata }) {
            return {
              data: {
                user: { id: fakeUserId, email, user_metadata }
              },
              error: null
            }
          }
        }
      },
      from(table) {
        return {
          upsert(payload) {
            provisionedTables[table].push(payload)
            const singleResult = async () => ({
              data: {
                id: fakeUserId,
                role: 'student',
                name: payload.name || 'Ana Teste',
                email: payload.email || 'ana@exemplo.com',
                birth_date: payload.birth_date || '1999-04-12',
                plan: 'free',
                timezone: 'America/Sao_Paulo',
                onboarding_done: false,
                streak: 0,
                study_days: 0
              },
              error: null
            })
            return {
              select() {
                return { single: singleResult }
              },
              then(resolve) {
                return Promise.resolve({ data: payload, error: null }).then(resolve)
              }
            }
          }
        }
      },
      rpc: async (fn) => {
        if (fn === 'check_rate_limit') {
          return { data: { allowed: true, count: 1, limit: 10, remaining: 9 }, error: null }
        }
        return { data: { seq: 1 }, error: null }
      }
    }

    const fakeCreateUserClient = (jwt = null) => ({
      auth: {
        async signInWithPassword({ email }) {
          return {
            data: {
              user: { id: fakeUserId, email },
              session: { access_token: 'jwt_real_supabase_token', refresh_token: 'ref_token_1' }
            },
            error: null
          }
        },
        async getUser(token) {
          if (token === 'jwt_real_supabase_token') {
            return { data: { user: { id: fakeUserId, email: 'ana@exemplo.com' } }, error: null }
          }
          return { data: { user: null }, error: new Error('invalid_jwt') }
        },
        async signOut() {
          return { error: null }
        }
      },
      from(table) {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    if (table === 'profiles') {
                      return {
                        data: {
                          id: fakeUserId,
                          role: 'student',
                          name: 'Ana Teste',
                          email: 'ana@exemplo.com',
                          birth_date: '1999-04-12',
                          plan: 'free',
                          timezone: 'America/Sao_Paulo',
                          onboarding_done: false
                        },
                        error: null
                      }
                    }
                    return { data: { streak: 0, study_days: 0 }, error: null }
                  },
                  order() {
                    return {
                      async limit() {
                        return { data: [{ balance_after: 0 }], error: null }
                      }
                    }
                  }
                }
              }
            }
          },
          update() {
            return {
              async eq() {
                return { data: null, error: null }
              }
            }
          }
        }
      }
    })

    const sbApp = createApp(store, {
      useSupabase: true,
      serviceClient: fakeServiceClient,
      createUserClient: fakeCreateUserClient,
      inviteCode: 'CONVITE-REAL-MVP'
    })

    const reg = await request(sbApp).post('/v1/auth/register').send({
      name: 'Ana Teste',
      email: 'ana@exemplo.com',
      password: 'senha-segura-123',
      inviteCode: 'CONVITE-REAL-MVP',
      birthDate: '1999-04-12',
      student: true
    })
    expect(reg.status).toBe(201)
    expect(reg.body.token).toBe('jwt_real_supabase_token')
    expect(reg.body.nextStep).toBe('onboarding')
    expect(provisionedTables.profiles.length).toBe(1)
    expect(provisionedTables.user_consents.length).toBe(1)
    expect(provisionedTables.study_settings.length).toBe(1)
    expect(provisionedTables.noa_daily_budget.length).toBe(1)

    const onb = await request(sbApp)
      .post('/v1/auth/onboarding')
      .set(auth(reg.body.token))
      .send({ context: 'Concurso público', subjects: ['Direito'], minutesPerDay: 20 })
    expect(onb.status).toBe(200)
    expect(onb.body.goal).toBe(60)
  })

  it('etapa 3: aplica rate limit de 10 tentativas em /v1/auth/login', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post('/v1/auth/login').send({ provider: 'demo' })
      expect(res.status).toBe(422)
    }
    const limited = await request(app).post('/v1/auth/login').send({ provider: 'demo' })
    expect(limited.status).toBe(429)
    expect(limited.body.code).toBe('rate_limited')
  })

  it('trocar senha encerra as outras sessões', async () => {
    const token = await login()
    const before = await request(app).get('/v1/me/sessions').set(auth(token))
    expect(before.body.sessions.length).toBeGreaterThan(1)
    await request(app).post('/v1/me/password').set(auth(token)).send({ current: 'a', next: '12345678' })
    const after = await request(app).get('/v1/me/sessions').set(auth(token))
    expect(after.body.sessions.length).toBe(1)
  })

  it('etapa 4: /v1/me credita +1 Neurônio idempotente no dia, persiste settings/consents e /v1/wallet reflete o ledger', async () => {
    const fakeUserId = '22222222-3333-4444-8555-666666666666'
    const dbState = {
      profile: {
        id: fakeUserId,
        role: 'student',
        name: 'Carlos Teste',
        email: 'carlos@exemplo.com',
        birth_date: '1995-07-20',
        plan: 'free',
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        onboarding_done: true,
        settings: {},
        notifications: {
          intensity: 'padrao',
          reminderTime: '19:00',
          push: true,
          quietWindow: { start: '23:00', end: '07:30', learned: true, lockedForMinor: false },
          limits: { whatsappPerDay: 3, pushPerDay: 8 },
          sentToday: { whatsapp: 0, push: 0 }
        }
      },
      study: {
        user_id: fakeUserId,
        goal: 20,
        goal_suggested: 20,
        done_today: 0,
        day_key: '2026-11-13',
        streak: 4,
        study_days: 12,
        reschedules_week_key: '2026-W46',
        reschedules_used: 0,
        reschedules_limit: 3,
        fatigue_detection: true
      },
      consents: {
        user_id: fakeUserId,
        school_share: false,
        whatsapp: { lembretes: true, conquistas: false, conta: true, informativo: false },
        content_policy_accepted_version: null,
        content_policy_accepted_at: null
      },
      ledger: [],
      audit: [],
      passwordUpdates: []
    }

    const fakeServiceClient = {
      rpc: async (fn, args) => {
        if (fn === 'append_neuron_ledger_entry') {
          const existing = dbState.ledger.find(
            (e) => e.user_id === args.p_user_id && args.p_idempotency_key && e.idempotency_key === args.p_idempotency_key
          )
          if (existing) return { data: existing, error: null }
          const prevBalance = dbState.ledger.length ? dbState.ledger[0].balance_after : 0
          const nextBalance = prevBalance + args.p_amount
          if (nextBalance < 0) {
            return { data: null, error: { message: 'insufficient_balance', code: 'P0001' } }
          }
          const entry = {
            id: `led_${dbState.ledger.length + 1}`,
            seq: dbState.ledger.length + 1,
            user_id: args.p_user_id,
            amount: args.p_amount,
            balance_after: nextBalance,
            type: args.p_type,
            meta: args.p_meta || {},
            idempotency_key: args.p_idempotency_key || null,
            created_at: new Date().toISOString()
          }
          dbState.ledger.unshift(entry)
          return { data: entry, error: null }
        }
        if (fn === 'append_audit_entry') {
          const auditEntry = { seq: dbState.audit.length + 1, ...args }
          dbState.audit.push(auditEntry)
          return { data: auditEntry, error: null }
        }
        return { data: null, error: null }
      }
    }

    const fakeCreateUserClient = () => ({
      auth: {
        async getUser(token) {
          if (token === 'jwt_etapa4_token') {
            return { data: { user: { id: fakeUserId, email: dbState.profile.email } }, error: null }
          }
          return { data: { user: null }, error: new Error('invalid_jwt') }
        },
        async updateUser({ password }) {
          dbState.passwordUpdates.push(password)
          return { data: { user: { id: fakeUserId } }, error: null }
        }
      },
      from(table) {
        const filters = {}
        const builder = {
          select() {
            return builder
          },
          eq(col, val) {
            filters[col] = val
            return builder
          },
          order() {
            return builder
          },
          async limit(n) {
            if (table === 'neuron_ledger') {
              return { data: dbState.ledger.slice(0, n), error: null }
            }
            return { data: [], error: null }
          },
          async maybeSingle() {
            if (table === 'profiles') return { data: { ...dbState.profile }, error: null }
            if (table === 'study_settings') return { data: { ...dbState.study }, error: null }
            if (table === 'user_consents') return { data: { ...dbState.consents }, error: null }
            if (table === 'neuron_ledger') {
              const found = dbState.ledger.find(
                (e) =>
                  (!filters.user_id || e.user_id === filters.user_id) &&
                  (!filters.idempotency_key || e.idempotency_key === filters.idempotency_key)
              )
              return { data: found || null, error: null }
            }
            return { data: null, error: null }
          },
          update(patch) {
            if (table === 'profiles') Object.assign(dbState.profile, patch)
            if (table === 'study_settings') Object.assign(dbState.study, patch)
            if (table === 'user_consents') Object.assign(dbState.consents, patch)
            return builder
          },
          then(resolve) {
            if (table === 'neuron_ledger') {
              return Promise.resolve({ data: [...dbState.ledger], error: null }).then(resolve)
            }
            return Promise.resolve({ data: [], error: null }).then(resolve)
          }
        }
        return builder
      }
    })

    const sbApp = createApp(store, {
      useSupabase: true,
      serviceClient: fakeServiceClient,
      createUserClient: fakeCreateUserClient
    })

    const firstMe = await request(sbApp).get('/v1/me').set(auth('jwt_etapa4_token'))
    expect(firstMe.status).toBe(200)
    expect(firstMe.body.dailyCredit).toBeTruthy()
    expect(firstMe.body.dailyCredit.amount).toBe(1)
    expect(firstMe.body.dailyCredit.type).toBe('daily_access')
    expect(firstMe.body.user.balance).toBe(1)

    const secondMe = await request(sbApp).get('/v1/me').set(auth('jwt_etapa4_token'))
    expect(secondMe.status).toBe(200)
    expect(secondMe.body.dailyCredit).toBeNull()
    expect(secondMe.body.user.balance).toBe(1)

    const settingsRes = await request(sbApp)
      .patch('/v1/me/settings')
      .set(auth('jwt_etapa4_token'))
      .send({
        dailyGoal: 35,
        fatigueDetection: false,
        intensity: 'intenso',
        reminderTime: '20:30',
        accessibility: { reduceMotion: true }
      })
    expect(settingsRes.status).toBe(200)
    expect(settingsRes.body.study.goal).toBe(35)
    expect(settingsRes.body.study.fatigueDetection).toBe(false)
    expect(settingsRes.body.notifications.intensity).toBe('intenso')
    expect(settingsRes.body.notifications.reminderTime).toBe('20:30')
    expect(settingsRes.body.user.settings.accessibility.reduceMotion).toBe(true)

    const consentsRes = await request(sbApp)
      .patch('/v1/me/consents')
      .set(auth('jwt_etapa4_token'))
      .send({ schoolShare: true, whatsapp: { conquistas: true } })
    expect(consentsRes.status).toBe(200)
    expect(consentsRes.body.consents.schoolShare).toBe(true)
    expect(consentsRes.body.consents.whatsapp.conquistas).toBe(true)

    const pwRes = await request(sbApp)
      .post('/v1/me/password')
      .set(auth('jwt_etapa4_token'))
      .send({ current: 'antiga123', next: 'novaSenhaForte123' })
    expect(pwRes.status).toBe(200)
    expect(dbState.passwordUpdates).toEqual(['novaSenhaForte123'])

    const walletRes = await request(sbApp).get('/v1/wallet').set(auth('jwt_etapa4_token'))
    expect(walletRes.status).toBe(200)
    expect(walletRes.body.balance).toBe(1)
    expect(walletRes.body.ledger.length).toBe(1)
    expect(walletRes.body.ledger[0].type).toBe('daily_access')
    expect(walletRes.body.redeemable).toBe(false)
  })

  it('etapa 5: CRUD de pastas, decks e cards persiste no repositorio com isolamento por owner_id e limite de fixados', async () => {
    const userA = 'aaaa1111-2222-4333-8444-555555555555'
    const userB = 'bbbb1111-2222-4333-8444-555555555555'
    const tables = {
      profiles: [
        {
          id: userA,
          role: 'student',
          name: 'Aluna A',
          email: 'a@exemplo.com',
          birth_date: '1996-02-10',
          plan: 'free',
          locale: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          onboarding_done: true
        },
        {
          id: userB,
          role: 'student',
          name: 'Aluno B',
          email: 'b@exemplo.com',
          birth_date: '1994-09-15',
          plan: 'free',
          locale: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          onboarding_done: true
        }
      ],
      study_settings: [
        { user_id: userA, streak: 2, study_days: 5 },
        { user_id: userB, streak: 1, study_days: 2 }
      ],
      neuron_ledger: [],
      folders: [],
      decks: [],
      cards: [],
      deck_favorites: [],
      deck_publications: []
    }

    let idSeq = 1
    const nextId = (prefix) => `${prefix}_${idSeq++}`

    const buildQuery = (table, currentUserId) => {
      const state = {
        eqs: {},
        isNulls: [],
        op: 'select',
        payload: null
      }

      const matches = (row) => {
        if (table === 'decks' || table === 'cards' || table === 'folders') {
          if (row.owner_id !== currentUserId) return false
        }
        if (table === 'deck_favorites' && row.user_id !== currentUserId) return false
        for (const [k, v] of Object.entries(state.eqs)) {
          if (row[k] !== v) return false
        }
        for (const col of state.isNulls) {
          if (row[col] !== null && row[col] !== undefined) return false
        }
        return true
      }

      const execute = () => {
        const list = tables[table] || []
        if (state.op === 'insert') {
          const now = new Date().toISOString()
          const prefix = table === 'folders' ? 'f' : table === 'decks' ? 'd' : 'c'
          const created = {
            id: nextId(prefix),
            created_at: now,
            updated_at: now,
            deleted_at: null,
            ...state.payload
          }
          list.push(created)
          return [created]
        }
        if (state.op === 'update') {
          const updated = []
          for (const row of list) {
            if (matches(row)) {
              Object.assign(row, state.payload, { updated_at: new Date().toISOString() })
              updated.push({ ...row })
            }
          }
          return updated
        }
        if (state.op === 'delete') {
          const removed = []
          for (let i = list.length - 1; i >= 0; i -= 1) {
            if (matches(list[i])) {
              const [del] = list.splice(i, 1)
              removed.push(del)
              if (table === 'folders') {
                for (const d of tables.decks) {
                  if (d.folder_id === del.id) d.folder_id = null
                }
              }
            }
          }
          return removed
        }
        return list.filter(matches).map((r) => ({ ...r }))
      }

      const builder = {
        select() {
          return builder
        },
        insert(payload) {
          state.op = 'insert'
          state.payload = payload
          return builder
        },
        update(payload) {
          state.op = 'update'
          state.payload = payload
          return builder
        },
        delete() {
          state.op = 'delete'
          return builder
        },
        eq(col, val) {
          state.eqs[col] = val
          return builder
        },
        is(col, val) {
          if (val === null) state.isNulls.push(col)
          return builder
        },
        order() {
          return builder
        },
        async limit(n) {
          return { data: execute().slice(0, n), error: null }
        },
        async single() {
          const rows = execute()
          return { data: rows[0] || null, error: rows[0] ? null : new Error('not_found') }
        },
        async maybeSingle() {
          const rows = execute()
          return { data: rows[0] || null, error: null }
        },
        then(resolve) {
          return Promise.resolve({ data: execute(), error: null }).then(resolve)
        }
      }
      return builder
    }

    const fakeCreateUserClient = (jwt = null) => {
      const currentUserId = jwt === 'jwt_user_b' ? userB : userA
      return {
        auth: {
          async getUser(token) {
            if (token === 'jwt_user_a') return { data: { user: { id: userA } }, error: null }
            if (token === 'jwt_user_b') return { data: { user: { id: userB } }, error: null }
            return { data: { user: null }, error: new Error('invalid_jwt') }
          }
        },
        from(table) {
          return buildQuery(table, currentUserId)
        }
      }
    }

    const sbApp = createApp(store, {
      useSupabase: true,
      createUserClient: fakeCreateUserClient
    })

    const f1 = await request(sbApp)
      .post('/v1/folders')
      .set(auth('jwt_user_a'))
      .send({ name: 'Biologia' })
    expect(f1.status).toBe(201)
    expect(f1.body.folder.name).toBe('Biologia')
    expect(f1.body.folder.depth).toBe(1)

    const f2 = await request(sbApp)
      .post('/v1/folders')
      .set(auth('jwt_user_a'))
      .send({ name: 'Citologia', parentId: f1.body.folder.id })
    expect(f2.status).toBe(201)
    expect(f2.body.folder.depth).toBe(2)

    const f3 = await request(sbApp)
      .post('/v1/folders')
      .set(auth('jwt_user_a'))
      .send({ name: 'Organelas', parentId: f2.body.folder.id })
    expect(f3.status).toBe(201)
    expect(f3.body.folder.depth).toBe(3)

    const f4 = await request(sbApp)
      .post('/v1/folders')
      .set(auth('jwt_user_a'))
      .send({ name: 'Excesso', parentId: f3.body.folder.id })
    expect(f4.status).toBe(409)
    expect(f4.body.code).toBe('folder_depth')

    const createdDeck = await request(sbApp)
      .post('/v1/decks')
      .set(auth('jwt_user_a'))
      .send({ name: 'Membrana Plasmática', categoryId: 'vestibular', difficulty: 'medio' })
    expect(createdDeck.status).toBe(201)
    const deckId = createdDeck.body.deck.id

    const moveRes = await request(sbApp)
      .post(`/v1/folders/${f1.body.folder.id}/decks`)
      .set(auth('jwt_user_a'))
      .send({ deckId })
    expect(moveRes.status).toBe(200)
    expect(moveRes.body.deck.folderId).toBe(f1.body.folder.id)

    const addCard = await request(sbApp)
      .post(`/v1/decks/${deckId}/cards`)
      .set(auth('jwt_user_a'))
      .send({ front: 'O que é transporte ativo?', back: 'Transporte contra o gradiente com gasto de ATP.' })
    expect(addCard.status).toBe(201)
    const cardId = addCard.body.card.id
    expect(addCard.body.card.sched.state).toBe('new')

    const editCard = await request(sbApp)
      .patch(`/v1/decks/${deckId}/cards/${cardId}`)
      .set(auth('jwt_user_a'))
      .send({ front: 'Defina transporte ativo', back: 'Contra o gradiente usando ATP.' })
    expect(editCard.status).toBe(200)
    expect(editCard.body.card.front).toBe('Defina transporte ativo')

    const pinDeck = await request(sbApp)
      .patch(`/v1/decks/${deckId}`)
      .set(auth('jwt_user_a'))
      .send({ pinned: true, focus: true })
    expect(pinDeck.status).toBe(200)
    expect(pinDeck.body.deck.pinned).toBe(true)
    expect(pinDeck.body.deck.focus).toBe(true)
    expect(pinDeck.body.deck.progress.offlineReason).toBe('fixado')

    const detailA = await request(sbApp).get(`/v1/decks/${deckId}`).set(auth('jwt_user_a'))
    expect(detailA.status).toBe(200)
    expect(detailA.body.cards.length).toBe(1)
    expect(detailA.body.folder.id).toBe(f1.body.folder.id)

    const detailB = await request(sbApp).get(`/v1/decks/${deckId}`).set(auth('jwt_user_b'))
    expect(detailB.status).toBe(404)

    const libB = await request(sbApp).get('/v1/decks').set(auth('jwt_user_b'))
    expect(libB.status).toBe(200)
    expect(libB.body.decks.length).toBe(0)
    expect(libB.body.folders.length).toBe(0)

    const exp = await request(sbApp)
      .post(`/v1/decks/${deckId}/export`)
      .set(auth('jwt_user_a'))
      .send({ format: 'txt' })
    expect(exp.status).toBe(200)
    expect(exp.body.cards).toBe(1)

    const delCard = await request(sbApp)
      .delete(`/v1/decks/${deckId}/cards/${cardId}`)
      .set(auth('jwt_user_a'))
    expect(delCard.status).toBe(200)

    const detailAfterCardDel = await request(sbApp).get(`/v1/decks/${deckId}`).set(auth('jwt_user_a'))
    expect(detailAfterCardDel.body.cards.length).toBe(0)

    const delFolder = await request(sbApp)
      .delete(`/v1/folders/${f1.body.folder.id}`)
      .set(auth('jwt_user_a'))
    expect(delFolder.status).toBe(200)

    const detailAfterFolderDel = await request(sbApp).get(`/v1/decks/${deckId}`).set(auth('jwt_user_a'))
    expect(detailAfterFolderDel.body.deck.folderId).toBeNull()
  })
})

describe('estudo', () => {
  it('sessão do dia tem 18 cards em ~6 minutos e 2 de 3 reagendamentos usados', async () => {
    const token = await login()
    const res = await request(app).get('/v1/study/today').set(auth(token))
    expect(res.body.cardsDue).toBe(18)
    expect(res.body.estimatedMinutes).toBe(6)
    expect(res.body.reschedules.used).toBe(2)
    expect(res.body.nearestObjective.name).toBe('ENEM')
    expect(res.body.pendingOutcome.name).toBe('Prova de Cálculo I')
  })

  it('revisões são idempotentes por clientId e meta batida dá 5 Neurônios uma vez', async () => {
    const token = await login()
    const today = await request(app).get('/v1/study/today').set(auth(token))
    const reviews = today.body.cards.map((c, i) => ({ clientId: `cl_${i}`, cardId: c.id, rating: i % 3 === 0 ? 'again' : 'good', durationMs: 4000 }))
    const first = await request(app).post('/v1/reviews').set(auth(token)).send({ reviews })
    expect(first.body.accepted.length).toBe(18)
    const again = await request(app).post('/v1/reviews').set(auth(token)).send({ reviews })
    expect(again.body.duplicates.length).toBe(18)
    expect(again.body.doneToday).toBe(18)
    const more = Array.from({ length: 2 }, (_, i) => ({ clientId: `extra_${i}`, cardId: reviews[0].cardId, rating: 'good' }))
    const hit = await request(app).post('/v1/reviews').set(auth(token)).send({ reviews: more })
    expect(hit.body.goalHitToday).toBe(true)
    expect(hit.body.rewards[0].type).toBe('goal_bonus')
    expect(hit.body.rewards[0].amount).toBe(5)
    const noDouble = await request(app).post('/v1/reviews').set(auth(token)).send({ reviews: [{ clientId: 'x1', cardId: reviews[0].cardId, rating: 'easy' }] })
    expect(noDouble.body.rewards.length).toBe(0)
  })

  it('"Hoje não" reagenda até 3 vezes por semana', async () => {
    const token = await login()
    const ok = await request(app).post('/v1/study/skip').set(auth(token))
    expect(ok.status).toBe(200)
    expect(ok.body.status).toBe('reagendado')
    expect(ok.body.reschedules.used).toBe(3)
    await request(app).post('/v1/study/undo-skip').set(auth(token))
    await request(app).post('/v1/study/skip').set(auth(token))
    const blocked = await request(app).post('/v1/study/skip').set(auth(token))
    expect(blocked.status).toBe(409)
  })

  it('confirmar resultado de prova dá 5 Neurônios uma vez por objetivo', async () => {
    const token = await login()
    const first = await request(app).post('/v1/objectives/o2/outcome').set(auth(token)).send({ outcome: 'aprovado' })
    expect(first.body.reward.amount).toBe(5)
    const second = await request(app).post('/v1/objectives/o2/outcome').set(auth(token)).send({ outcome: 'aprovado' })
    expect(second.body.reward).toBeNull()
  })
})

describe('geração', () => {
  it('gratuito trava no 4º deck com upsell e chave de idempotência não conta duas vezes', async () => {
    const token = await login()
    const one = await request(app).post('/v1/generation/jobs').set(auth(token)).set('Idempotency-Key', 'k1').send({ source: 'file', documentName: 'a.pdf' })
    expect(one.status).toBe(201)
    const dup = await request(app).post('/v1/generation/jobs').set(auth(token)).set('Idempotency-Key', 'k1').send({ source: 'file', documentName: 'a.pdf' })
    expect(dup.body.duplicate).toBe(true)
    const quota = await request(app).get('/v1/generation/quota').set(auth(token))
    expect(quota.body.used).toBe(3)
    const fourth = await request(app).post('/v1/generation/jobs').set(auth(token)).send({ source: 'text', text: 'Qualquer texto' })
    expect(fourth.status).toBe(429)
    expect(fourth.body.upsell).toBe(true)
  })

  it('documento acima do orçamento pede páginas ou divisão', async () => {
    const token = await login()
    const res = await request(app).post('/v1/generation/jobs').set(auth(token)).send({ source: 'file', documentName: 'grande.pdf', sizeTokens: 400000 })
    expect(res.body.job.status).toBe('acima_do_orcamento')
    const scoped = await request(app).post(`/v1/generation/jobs/${res.body.job.id}/scope`).set(auth(token)).send({ pages: [1, 120] })
    expect(scoped.body.job.status).toBe('na_fila')
  })

  it('texto com dados pessoais de terceiros é filtrado na entrada', async () => {
    const token = await login()
    const res = await request(app).post('/v1/generation/jobs').set(auth(token)).send({ source: 'text', text: 'Nome: João, CPF 123.456.789-00' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('content_filtered')
  })
})

describe('carteira e cupons (legado com flags ativas)', () => {
  beforeEach(() => {
    app = createApp(store, { features: ALL_FEATURES })
  })

  it('resgate do último cupom é atômico: dois pedidos, um sucesso', async () => {
    const token = await login()
    const [a, b] = await Promise.all([
      request(app).post('/v1/coupons/cp3/redeem').set(auth(token)).send({ idempotencyKey: 'r1' }),
      request(app).post('/v1/coupons/cp3/redeem').set(auth(token)).send({ idempotencyKey: 'r2' })
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])
    const wallet = await request(app).get('/v1/wallet').set(auth(token))
    expect(wallet.body.balance).toBe(148 - 60)
  })

  it('mesma chave de idempotência devolve o mesmo cupom sem debitar de novo', async () => {
    const token = await login()
    const a = await request(app).post('/v1/coupons/cp1/redeem').set(auth(token)).send({ idempotencyKey: 'same' })
    const b = await request(app).post('/v1/coupons/cp1/redeem').set(auth(token)).send({ idempotencyKey: 'same' })
    expect(b.body.duplicate).toBe(true)
    expect(b.body.myCoupon.code).toBe(a.body.myCoupon.code)
  })

  it('menor com 6 dias de estudo não resgata', async () => {
    await request(app).post('/v1/_proto/profile').send({ profile: 'minor' })
    const token = await login()
    const res = await request(app).post('/v1/coupons/cp1/redeem').set(auth(token)).send({})
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('study_days_required')
  })

  it('parceiro dá baixa uma única vez no código', async () => {
    const token = await login('partner')
    const ok = await request(app).post('/v1/partner/redemptions/validate').set(auth(token)).send({ code: 'MEM-7K2P-91QX' })
    expect(ok.status).toBe(200)
    const again = await request(app).post('/v1/partner/redemptions/validate').set(auth(token)).send({ code: 'MEM-7K2P-91QX' })
    expect(again.status).toBe(409)
  })
})

describe('comunidade e moderação', () => {
  it('publicar exige aceitar a política uma vez e cria snapshot na fila', async () => {
    const token = await login()
    const needs = await request(app).post('/v1/decks/d1/publish').set(auth(token)).send({})
    expect(needs.status).toBe(428)
    const ok = await request(app).post('/v1/decks/d1/publish').set(auth(token)).send({ acceptPolicy: true })
    expect(ok.status).toBe(201)
    expect(ok.body.publication.status).toBe('em_triagem')
    expect(ok.body.publication.snapshot.length).toBe(8)
    const second = await request(app).post('/v1/decks/d3/publish').set(auth(token)).send({})
    expect(second.status).toBe(201)
  })

  it('menor sem liberação recebe bloqueio e a solicitação chega ao responsável', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    await request(app).post('/v1/_proto/profile').send({ profile: 'minor' })
    const token = await login()
    const res = await request(app).post('/v1/community/decks/c1/share').set(auth(token)).send({ channel: 'whatsapp' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('guardian_required')
    const gtoken = await login('guardian')
    const overview = await request(app).get('/v1/parental/overview').set(auth(gtoken))
    expect(overview.body.requests.some((r) => r.type === 'publicLink' && r.status === 'pendente')).toBe(true)
    const decide = await request(app).post(`/v1/parental/requests/${res.body.request.id}/decide`).set(auth(gtoken)).send({ approve: true })
    expect(decide.body.permissions.publicLink).toBe(true)
    const retry = await request(app).post('/v1/community/decks/c1/share').set(auth(token)).send({ channel: 'whatsapp' })
    expect(retry.status).toBe(200)
  })

  it('voto só após 30% dos cards ou 20 cards', async () => {
    const token = await login()
    const denied = await request(app).post('/v1/community/decks/c4/vote').set(auth(token))
    expect(denied.status).toBe(403)
    const allowed = await request(app).post('/v1/community/decks/c1/vote').set(auth(token))
    expect(allowed.status).toBe(200)
    expect(allowed.body.voted).toBe(true)
  })

  it('moderador aprova e o deck aparece na comunidade; rejeição exige motivo e trecho', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const mod = await login('admin:moderador')
    const bad = await request(app).post('/v1/admin/moderation/pub2/decide').set(auth(mod)).send({ decision: 'rejeitado' })
    expect(bad.status).toBe(422)
    const ok = await request(app).post('/v1/admin/moderation/pub2/decide').set(auth(mod)).send({ decision: 'aprovado' })
    expect(ok.body.publication.status).toBe('aprovado')
    const token = await login()
    const search = await request(app).get('/v1/community/search?q=Citologia').set(auth(token))
    expect(search.body.results.some((d) => d.name === 'Citologia')).toBe(true)
  })

  it('contestação não pode ser revisada pelo moderador original', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const hugo = await request(app).post('/v1/admin/auth/login').send({ role: 'moderador' })
    store.state.appeals[0].originalReviewer = hugo.body.user.id
    const res = await request(app).post('/v1/admin/moderation/appeals/ap1/decide').set(auth(hugo.body.token)).send({ decision: 'aceita' })
    expect(res.status).toBe(403)
  })
})

describe('B2B, assinatura e auditoria', () => {
  beforeEach(() => {
    app = createApp(store, { features: ALL_FEATURES })
  })

  it('agregados só com 10 alunos consentidos e nunca há ranking', async () => {
    const token = await login('b2b:coordenador')
    const res = await request(app).get('/v1/b2b/overview').set(auth(token))
    const k2 = res.body.classes.find((k) => k.name === '3º B')
    expect(k2.aggregates).toBeNull()
    expect(k2.aggregateBlockedReason).toContain('10 alunos')
    expect(res.body.rules.noRankingBetweenStudents).toBe(true)
  })

  it('reembolso em 7 dias volta ao gratuito e cancelamento mantém acesso', async () => {
    await request(app).post('/v1/_proto/profile').send({ profile: 'adult-premium' })
    const token = await login()
    const cancel = await request(app).post('/v1/subscription/cancel').set(auth(token))
    expect(cancel.body.subscription.plan).toBe('premium')
    const refund = await request(app).post('/v1/subscription/refund').set(auth(token))
    expect(refund.status).toBe(200)
    expect(refund.body.subscription.plan).toBe('free')
  })

  it('webhook do gateway é idempotente', async () => {
    const a = await request(app).post('/v1/subscription/webhook').send({ eventId: 'ev1', type: 'payment_failed' })
    const b = await request(app).post('/v1/subscription/webhook').send({ eventId: 'ev1', type: 'payment_failed' })
    expect(a.body.duplicate).toBeUndefined()
    expect(b.body.duplicate).toBe(true)
  })

  it('log de auditoria mantém a cadeia de hashes', async () => {
    const token = await login()
    await request(app).post('/v1/study/skip').set(auth(token))
    const check = verifyChain(store.state.auditLog)
    expect(check.ok).toBe(true)
    expect(check.length).toBeGreaterThan(4)
  })

  it('suporte só vê a conta com finalidade e consentimento registrados', async () => {
    const token = await login('admin:suporte_n1')
    const denied = await request(app).post('/v1/admin/support/users/u1/view-as').set(auth(token)).send({})
    expect(denied.status).toBe(422)
    const ok = await request(app).post('/v1/admin/support/users/u1/view-as').set(auth(token)).send({ purpose: 'Chamado tk1', consentReference: 'chat 09/09 10:12' })
    expect(ok.body.mode).toBe('ver_como_somente_leitura')
    expect(store.state.accessLog.length).toBe(1)
  })
})

describe('privacidade, sessões e contestação do autor', () => {
  it('o autor contesta a rejeição e cai com um moderador diferente do original', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const mod = await login('admin:moderador')
    const rejected = await request(app).post('/v1/admin/moderation/pub2/decide').set(auth(mod)).send({ decision: 'rejeitado', reasonCategory: 'veracidade', excerpt: 'Card 2: o núcleo não armazena RNA.' })
    expect(rejected.body.publication.status).toBe('rejeitado')
    const original = rejected.body.publication.decision.by
    const token = await login()
    const deck = await request(app).get('/v1/decks/d2').set(auth(token))
    expect(deck.body.deck.publication.lastRejection.reasonCategory).toBe('veracidade')
    const appeal = await request(app).post('/v1/publications/pub2/appeal').set(auth(token)).send({ text: 'Corrigi o card antes da revisão.' })
    expect(appeal.status).toBe(201)
    expect(appeal.body.appeal.originalReviewer).toBe(original)
    expect(appeal.body.appeal.reviewer).not.toBe(original)
    const again = await request(app).post('/v1/publications/pub2/appeal').set(auth(token)).send({ text: 'de novo' })
    expect(again.status).toBe(409)
    expect(again.body.code).toBe('appeal_exists')
  })

  it('não contesta publicação de outro autor', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const token = await login()
    const res = await request(app).post('/v1/publications/pub5/appeal').set(auth(token)).send({ text: 'não é minha' })
    expect(res.status).toBe(404)
  })

  it('conta desativada não ganha Neurônio nem publica, e reativa', async () => {
    const token = await login()
    const before = (await request(app).get('/v1/me').set(auth(token))).body.user.balance
    const del = await request(app).post('/v1/privacy/delete').set(auth(token))
    expect(del.body.deletion.purgeAt).toBeTruthy()
    store.state.ledger = store.state.ledger.filter((e) => e.type !== 'daily_access' || e.ts < new Date(Date.now() - 86400000).toISOString())
    const after = await request(app).get('/v1/me').set(auth(token))
    expect(after.body.dailyCredit).toBeNull()
    expect(after.body.user.deactivatedAt).toBeTruthy()
    const publish = await request(app).post('/v1/decks/d1/publish').set(auth(token)).send({ acceptPolicy: true })
    expect(publish.status).toBe(403)
    expect(publish.body.code).toBe('account_deactivated')
    await request(app).post('/v1/privacy/reactivate').set(auth(token))
    const back = await request(app).get('/v1/me').set(auth(token))
    expect(back.body.user.deactivatedAt).toBeNull()
    expect(back.body.user.balance).toBeGreaterThanOrEqual(before - 1)
  })

  it('sessão sem uso por mais de 30 dias é rejeitada', async () => {
    const token = await login()
    const session = store.state.sessions.find((s) => s.token === token)
    session.lastUsedAt = new Date(Date.now() - 31 * 86400000).toISOString()
    const res = await request(app).get('/v1/me').set(auth(token))
    expect(res.status).toBe(401)
    expect(store.state.sessions.some((s) => s.token === token)).toBe(false)
  })

  it('histórico de estudo junta decks próprios e da comunidade', async () => {
    const token = await login()
    const today = await request(app).get('/v1/study/today').set(auth(token))
    await request(app)
      .post('/v1/reviews')
      .set(auth(token))
      .send({ reviews: [{ clientId: 'h1', cardId: today.body.cards[0].id, rating: 'good' }, { clientId: 'h2', cardId: 'c1_c1', rating: 'good' }] })
    const history = await request(app).get('/v1/study/history').set(auth(token))
    expect(history.body.items.some((i) => i.kind === 'own')).toBe(true)
    expect(history.body.items.some((i) => i.kind === 'community' && i.name === 'Bioquímica: Ciclo de Krebs')).toBe(true)
    expect(history.body.created.length).toBeGreaterThan(0)
  })

  it('Nôa recomenda decks da comunidade a partir do que o aluno estuda', async () => {
    const token = await login()
    const feed = await request(app).get('/v1/community/feed').set(auth(token))
    expect(feed.body.recommendations.length).toBeGreaterThan(0)
    expect(feed.body.recommendations.every((d) => d.becauseDeck)).toBe(true)
  })

  it('a fila de moderação traz o contato suspeito sinalizado por Nôa com SLA de 4 h', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const token = await login('admin:moderador')
    const reports = await request(app).get('/v1/admin/moderation/reports').set(auth(token))
    const flagged = reports.body.reports.find((r) => r.targetType === 'contato_suspeito')
    expect(flagged.slaHours).toBe(4)
    expect(flagged.reporter).toBe('noa')
    const appeals = await request(app).get('/v1/admin/moderation/appeals').set(auth(token))
    expect(Array.isArray(appeals.body.appeals)).toBe(true)
  })

  it('templates de notificação acima de 2% de opt-out saem desativados', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const token = await login('admin:engenharia')
    const res = await request(app).get('/v1/admin/engineering/overview').set(auth(token))
    const templates = res.body.notificationTemplates
    expect(templates.length).toBeGreaterThan(0)
    expect(templates.every((tpl) => (tpl.optOut > res.body.notificationOptOutLimit ? tpl.disabled : true))).toBe(true)
    expect(templates.find((tpl) => tpl.key === 'informativo_memoria').disabled).toBe(true)
  })

  it('revisão com horário implausível entra na fila antifraude', async () => {
    app = createApp(store, { features: ALL_FEATURES })
    const token = await login()
    const today = await request(app).get('/v1/study/today').set(auth(token))
    const res = await request(app)
      .post('/v1/reviews')
      .set(auth(token))
      .send({ reviews: [{ clientId: 'af1', cardId: today.body.cards[0].id, rating: 'good', reviewedAt: new Date(Date.now() - 72 * 3600000).toISOString() }] })
    expect(res.body.flagged).toEqual(['af1'])
    expect(store.state.antifraud.length).toBe(1)
    const eng = await login('admin:engenharia')
    const overview = await request(app).get('/v1/admin/engineering/overview').set(auth(eng))
    expect(overview.body.antifraud.length).toBe(1)
  })
})
