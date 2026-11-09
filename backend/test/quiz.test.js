import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createStore } from '../src/store.js'

let store
let app
let token

const auth = () => ({ Authorization: `Bearer ${token}` })
const attempt = (answers, materialId = 'm10') => request(app).post(`/v1/community/materials/${materialId}/quiz-attempts`).set(auth()).send({ answers })
const review = (materialId = 'm10') => request(app).post(`/v1/community/materials/${materialId}/quiz-review`).set(auth())

const ALL_RIGHT = { q1: 2, q2: 1, q3: 0, q4: 1, q5: 0, q6: 1 }
const TWO_WRONG = { ...ALL_RIGHT, q1: 0, q4: 3 }

beforeEach(async () => {
  store = createStore()
  app = createApp(store)
  token = (await request(app).post('/v1/auth/login').send({ provider: 'google' })).body.token
})

describe('tentativas de quiz', () => {
  it('corrige no servidor, guarda a tentativa e devolve melhor nota e total de tentativas', async () => {
    const first = await attempt(TWO_WRONG)
    expect(first.status).toBe(201)
    expect(first.body).toEqual({ score: 4, total: 6, wrong: ['q1', 'q4'], best: 4, attempts: 1 })
    const second = await attempt({ ...ALL_RIGHT, q2: 0 })
    expect(second.body).toMatchObject({ score: 5, wrong: ['q2'], best: 5, attempts: 2 })
    const third = await attempt(TWO_WRONG)
    expect(third.body).toMatchObject({ score: 4, best: 5, attempts: 3 })
    expect(store.state.community.quizAttempts).toHaveLength(3)
    expect(store.state.community.quizAttempts[0]).toMatchObject({ materialId: 'm10', score: 4, total: 6 })
  })

  it('trata questão sem resposta ou com índice inválido como errada', async () => {
    const res = await attempt({ q1: 2, q2: 9, q3: 'a' })
    expect(res.body).toMatchObject({ score: 1, total: 6, wrong: ['q2', 'q3', 'q4', 'q5', 'q6'] })
  })

  it('recusa respostas em formato errado e conteúdo que não é quiz', async () => {
    expect((await attempt([2, 1])).status).toBe(422)
    expect((await attempt({})).status).toBe(422)
    const notQuiz = await attempt(ALL_RIGHT, 'm11')
    expect(notQuiz.status).toBe(422)
    expect(notQuiz.body.code).toBe('not_quiz')
    expect((await attempt(ALL_RIGHT, 'm999')).status).toBe(404)
    expect(store.state.community.quizAttempts).toHaveLength(0)
  })

  it('GET do material inclui viewer.quiz com melhor nota, tentativas e a última', async () => {
    const before = await request(app).get('/v1/community/materials/m10').set(auth())
    expect(before.body.material.viewer.quiz).toEqual({ best: null, attempts: 0, last: null })
    await attempt(ALL_RIGHT)
    await attempt(TWO_WRONG)
    const after = await request(app).get('/v1/community/materials/m10').set(auth())
    expect(after.body.material.viewer.quiz).toMatchObject({ best: 6, attempts: 2, last: { score: 4, total: 6, wrong: ['q1', 'q4'] } })
    const timeline = await request(app).get('/v1/community/materials/m11').set(auth())
    expect(timeline.body.material.viewer.quiz).toBeUndefined()
  })
})

describe('revisão das erradas com flashcards', () => {
  it('cria um deck agendado com um card por questão errada da última tentativa', async () => {
    await attempt({ ...ALL_RIGHT, q2: 0 })
    await attempt(TWO_WRONG)
    const res = await review()
    expect(res.status).toBe(201)
    expect(res.body.cards).toBe(2)
    const deck = store.state.decks.find((d) => d.id === res.body.deckId)
    expect(deck).toMatchObject({ name: 'Revisão: Quiz: princípios da Administração Pública', scheduled: true, categoryId: 'concursos', publication: { status: 'nao_publicado' } })
    expect(deck.mcpReview).toBeUndefined()
    const cards = store.state.cards.filter((c) => c.deckId === deck.id)
    expect(cards.map((c) => c.front)).toEqual([expect.stringContaining('cônjuge'), expect.stringContaining('eficiência')])
    expect(cards[0].back).toBe('Moralidade · A Súmula Vinculante 13 veda o nepotismo com base na moralidade administrativa.')
    expect(cards[0].back).toContain('Súmula Vinculante 13')
    expect(cards[1].back).toContain('EC 19/1998')
    expect(cards[0].sched.state).toBe('new')
    const detail = await request(app).get(`/v1/decks/${deck.id}`).set(auth())
    expect(detail.status).toBe(200)
  })

  it('responde 422 quando não há erradas ou nenhuma tentativa', async () => {
    const none = await review()
    expect(none.status).toBe(422)
    expect(none.body.code).toBe('nothing_to_review')
    await attempt(TWO_WRONG)
    await attempt(ALL_RIGHT)
    const perfect = await review()
    expect(perfect.status).toBe(422)
    expect(perfect.body.message).toMatch(/acertou tudo/)
    expect(store.state.decks.some((d) => d.source?.type === 'quiz')).toBe(false)
  })
})
