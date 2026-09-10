import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createStore } from '../src/store.js'
import { verifyChain } from '../src/lib/audit.js'

let store
let app

async function login(role = 'student') {
  if (role === 'student') {
    const res = await request(app).post('/v1/auth/login').send({ provider: 'google' })
    return res.body.token
  }
  if (role === 'guardian') return (await request(app).post('/v1/parental/auth/login').send({ email: 'p@x.com', password: 'x' })).body.token
  if (role === 'partner') return (await request(app).post('/v1/partner/auth/login').send({ cnpj: '12.345.678/0001-90', password: 'x' })).body.token
  if (role.startsWith('admin:')) return (await request(app).post('/v1/admin/auth/login').send({ role: role.split(':')[1] })).body.token
  if (role.startsWith('b2b:')) return (await request(app).post('/v1/b2b/auth/login').send({ role: role.split(':')[1] })).body.token
  throw new Error('role')
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeEach(() => {
  store = createStore()
  app = createApp(store)
})

describe('conta e acesso', () => {
  it('login devolve token e usuário verificado', async () => {
    const res = await request(app).post('/v1/auth/login').send({ provider: 'google' })
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
    const body = { name: 'Teste', email: 'a@b.co', phone: '11999990000', birthDate: '2000-01-01', student: true }
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/v1/auth/register').send(body)
      expect(res.status).toBe(201)
    }
    const blocked = await request(app).post('/v1/auth/register').send(body)
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('captcha_required')
  })

  it('trocar senha encerra as outras sessões', async () => {
    const token = await login()
    const before = await request(app).get('/v1/me/sessions').set(auth(token))
    expect(before.body.sessions.length).toBeGreaterThan(1)
    await request(app).post('/v1/me/password').set(auth(token)).send({ current: 'a', next: '12345678' })
    const after = await request(app).get('/v1/me/sessions').set(auth(token))
    expect(after.body.sessions.length).toBe(1)
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

describe('carteira e cupons', () => {
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
    const hugo = await request(app).post('/v1/admin/auth/login').send({ role: 'moderador' })
    store.state.appeals[0].originalReviewer = hugo.body.user.id
    const res = await request(app).post('/v1/admin/moderation/appeals/ap1/decide').set(auth(hugo.body.token)).send({ decision: 'aceita' })
    expect(res.status).toBe(403)
  })
})

describe('B2B, assinatura e auditoria', () => {
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
    const token = await login('admin:moderador')
    const reports = await request(app).get('/v1/admin/moderation/reports').set(auth(token))
    const flagged = reports.body.reports.find((r) => r.targetType === 'contato_suspeito')
    expect(flagged.slaHours).toBe(4)
    expect(flagged.reporter).toBe('noa')
    const appeals = await request(app).get('/v1/admin/moderation/appeals').set(auth(token))
    expect(Array.isArray(appeals.body.appeals)).toBe(true)
  })

  it('templates de notificação acima de 2% de opt-out saem desativados', async () => {
    const token = await login('admin:engenharia')
    const res = await request(app).get('/v1/admin/engineering/overview').set(auth(token))
    const templates = res.body.notificationTemplates
    expect(templates.length).toBeGreaterThan(0)
    expect(templates.every((tpl) => (tpl.optOut > res.body.notificationOptOutLimit ? tpl.disabled : true))).toBe(true)
    expect(templates.find((tpl) => tpl.key === 'informativo_memoria').disabled).toBe(true)
  })

  it('revisão com horário implausível entra na fila antifraude', async () => {
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
