import { daysFromNow, hoursFromNow, dayKey, nowIso } from '../lib/ids.js'
import { appendEntry } from '../lib/ledger.js'
import { appendAudit } from '../lib/audit.js'
import { CATEGORIES, REACTIONS, ownDecks, communityContent } from './content.js'
import { seedPanels } from './panels.js'
import { seedMaterials } from './materials.js'

const birthDateYearsAgo = (years) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  d.setMonth(2, 22)
  return d.toISOString().slice(0, 10)
}

export const PROFILES = {
  'adult-free': {
    name: 'Manoel',
    email: 'manoel@exemplo.com',
    phone: '+55 11 99999-0001',
    birthDate: birthDateYearsAgo(27),
    isMinor: false,
    guardianId: null,
    plan: 'free',
    studyDays: 33,
    accountAgeDays: 44
  },
  'adult-premium': {
    name: 'Manoel',
    email: 'manoel@exemplo.com',
    phone: '+55 11 99999-0001',
    birthDate: birthDateYearsAgo(27),
    isMinor: false,
    guardianId: null,
    plan: 'premium',
    studyDays: 33,
    accountAgeDays: 44
  },
  minor: {
    name: 'Lucas',
    email: 'lucas.alves@exemplo.com',
    phone: '+55 11 98888-0002',
    birthDate: birthDateYearsAgo(15),
    isMinor: true,
    guardianId: 'g1',
    plan: 'free',
    studyDays: 6,
    accountAgeDays: 6
  }
}

export function seedLedger(state) {
  const userId = 'u1'
  const entries = []
  for (let d = -44; d <= -1; d += 1) {
    if (d % 4 === 0) continue
    entries.push({ ts: daysFromNow(d, 7), amount: 1, type: 'daily_access', meta: {} })
    if (d % 3 !== 0) entries.push({ ts: daysFromNow(d, 20), amount: 5, type: 'goal_bonus', meta: { goal: 20 } })
  }
  entries.push({ ts: daysFromNow(-30, 15), amount: 20, type: 'referral_bonus', meta: { referred: 'Camila Prado' } })
  const cloneDays = [-35, -33, -28, -24, -19, -15, -11, -6, -2]
  cloneDays.forEach((d, i) => entries.push({ ts: daysFromNow(d, 14), amount: 5, type: 'clone_bonus', meta: { deckId: 'd6', deckName: 'Direito Administrativo', clonedBy: `Estudante ${i + 1}` } }))
  entries.push({ ts: daysFromNow(-31, 18), amount: -30, type: 'coupon_redeem', meta: { couponId: 'cp1', partner: 'Café Sinapse', myCouponId: 'mc2' } })
  entries.push({ ts: daysFromNow(-20, 18), amount: -30, type: 'coupon_redeem', meta: { couponId: 'cp1', partner: 'Café Sinapse', myCouponId: 'mc1' } })
  entries.push({ ts: daysFromNow(-6, 12), amount: -30, type: 'coupon_redeem', meta: { couponId: 'cp1', partner: 'Café Sinapse', myCouponId: 'mc3' } })
  entries.push({ ts: daysFromNow(-1, 9), amount: 30, type: 'coupon_expired_refund', meta: { couponId: 'cp1', partner: 'Café Sinapse', myCouponId: 'mc2' } })
  entries.sort((a, b) => a.ts.localeCompare(b.ts))
  entries.forEach((e) => appendEntry(state, { userId, ...e }))
}

export function applyProfile(state, key) {
  const profile = PROFILES[key] || PROFILES['adult-free']
  const user = state.users.find((u) => u.id === 'u1')
  Object.assign(user, {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    birthDate: profile.birthDate,
    isMinor: profile.isMinor,
    guardianId: profile.guardianId,
    plan: profile.plan,
    createdAt: daysFromNow(-profile.accountAgeDays)
  })
  state.profile = key
  state.study.u1.studyDays = profile.studyDays
  state.notifications.u1.intensity = profile.isMinor ? 'leve' : state.notifications.u1.intensity === 'leve' ? 'padrao' : state.notifications.u1.intensity
  state.notifications.u1.quietWindow = profile.isMinor
    ? { start: '21:00', end: '07:00', learned: false, lockedForMinor: true }
    : { start: '23:00', end: '07:30', learned: true, lockedForMinor: false }
  if (profile.plan === 'premium') {
    state.subscriptions.u1 = {
      plan: 'premium',
      cycle: 'mensal',
      priceBRL: 29.9,
      method: 'Pix Automático',
      startedAt: daysFromNow(-3),
      renewsAt: daysFromNow(27),
      refundEligibleUntil: daysFromNow(4),
      fairUse: { usedBRL: 12.4, capBRL: 20, generationsMonth: 24, degraded: false },
      payments: [
        { id: 'pay1', at: daysFromNow(-3), amountBRL: 29.9, method: 'Pix Automático', status: 'pago', nfse: { number: 'NFS-e 2026/00412', availableAt: daysFromNow(-1), url: '#nfse-00412' } }
      ],
      dunning: null,
      cancelledAt: null
    }
  } else {
    state.subscriptions.u1 = {
      plan: 'free',
      offer: { monthlyBRL: 29.9, yearlyBRL: 239.9, yearlyPerMonthBRL: 19.99 },
      payments: [],
      cancelledAt: null
    }
  }
  return user
}

export function seed(profileKey = 'adult-free') {
  const { decks, cards, folders } = ownDecks()
  decks.forEach((d) => {
    d.scheduled = ['d1', 'd2', 'd3', 'd5'].includes(d.id)
  })
  const community = communityContent()
  const panels = seedPanels()

  const state = {
    seededAt: nowIso(),
    profile: profileKey,
    categories: CATEGORIES,
    reactions: REACTIONS,
    users: [
      {
        id: 'u1',
        role: 'student',
        name: 'Manoel',
        email: 'manoel@exemplo.com',
        phone: '+55 11 99999-0001',
        birthDate: PROFILES['adult-free'].birthDate,
        isMinor: false,
        guardianId: null,
        plan: 'free',
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        verified: { email: true, phone: true },
        ageVerification: { status: 'aprovado', method: 'documento + prova de vida', provider: 'Verificador homologado', verifiedAt: daysFromNow(-44), documentDeletedAt: hoursFromNow(-44 * 24 + 21), documentHash: 'b3a1…77f0', verifiedBy: 'Verificador homologado' },
        createdAt: daysFromNow(-44),
        origin: 'Indicação de um amigo',
        publicProfile: { level: 3, topic: 'Direito', points: 1240, badges: [], cardsGenerated: 35 }
      },
      { id: 'g1', role: 'guardian', name: 'Patrícia Alves', email: 'patricia.alves@exemplo.com', phone: '+55 11 98888-0001', verified: { email: true, phone: true } },
      ...panels.b2b.users.map((u) => ({ ...u, role: `b2b_${u.role}`, tenantId: 't1' })),
      ...panels.admin.users.map((u) => ({ ...u, role: `admin_${u.role}` })),
      { id: 'pt1', role: 'partner', name: 'Renata Prado', email: 'renata@cafesinapse.com.br', partnerId: 'p1' }
    ],
    registrationsByIp: {},
    sessions: [
      { id: 'ses_nb', token: null, userId: 'u1', role: 'student', device: 'Notebook · Windows · Edge', location: 'São Paulo, BR', createdAt: daysFromNow(-12), lastUsedAt: hoursFromNow(-2), current: false },
      { id: 'ses_ipad', token: null, userId: 'u1', role: 'student', device: 'iPad · Safari', location: 'Rio de Janeiro, BR', createdAt: daysFromNow(-30), lastUsedAt: daysFromNow(-9), current: false }
    ],
    decks,
    cards,
    folders,
    community: {
      authors: community.authors,
      decks: community.decks,
      cards: community.cards,
      comments: community.comments,
      follows: [{ userId: 'u1', authorId: 'a1' }],
      favorites: [{ userId: 'u1', deckId: 'c1', folderId: 'f2', at: daysFromNow(-5) }],
      votes: [],
      myReactions: [{ userId: 'u1', deckId: 'c1', emoji: '🧠' }],
      answered: { u1: { c1: 4 } },
      shares: [],
      materialFavorites: [{ userId: 'u1', materialId: 'm2', at: daysFromNow(-1) }],
      materialReactions: []
    },
    materials: seedMaterials(),
    mcp: {
      connections: [{ id: 'mcp_seed1', userId: 'u1', name: 'Claude Desktop', token: null, tokenHint: 'a91f', client: 'claude-ai', createdAt: daysFromNow(-6), lastUsedAt: hoursFromNow(-3), revokedAt: null }],
      activity: [{ id: 'act_seed1', userId: 'u1', connectionId: 'mcp_seed1', client: 'claude-ai', tool: 'salvar_mapa_mental', write: true, ok: true, targetType: 'material', targetId: 'm7', title: 'Como funciona a repetição espaçada', at: hoursFromNow(-3) }]
    },
    publications: [
      { id: 'pub1', deckId: 'd6', authorId: 'u1', authorName: 'Manoel', deckName: 'Direito Administrativo', version: 1, status: 'aprovado', plan: 'free', submittedAt: daysFromNow(-17), decidedAt: daysFromNow(-15), slaHours: 72, risk: { score: 12, level: 'baixo', factors: ['Sem duplicidade', 'Idioma consistente', 'Completude 100%'] }, reviewType: 'integral', reviewReason: 'Primeiros 5 decks do autor', assignedTo: 'adm8', decision: { by: 'adm8', decision: 'aprovado', reasonCategory: null, excerpt: null }, publicId: 'p-adm-2026', categoryId: 'concursos', difficulty: 'medio', cardCount: 5 },
      { id: 'pub2', deckId: 'd2', authorId: 'u1', authorName: 'Manoel', deckName: 'Citologia', version: 1, status: 'em_triagem', plan: 'free', submittedAt: hoursFromNow(-30), decidedAt: null, slaHours: 72, risk: { score: 18, level: 'baixo', factors: ['Sem duplicidade', 'Idioma consistente', '1 card com imagem sem texto alternativo'] }, reviewType: 'integral', reviewReason: 'Primeiros 5 decks do autor', assignedTo: 'adm1', decision: null, publicId: null, categoryId: 'vestibular', difficulty: 'medio', cardCount: 6 },
      { id: 'pub3', deckId: 'x_d1', authorId: 'x6', authorName: 'Carlos T.', deckName: 'Anatomia: ossos do crânio', version: 1, status: 'em_revisao', plan: 'premium', submittedAt: hoursFromNow(-20), decidedAt: null, slaHours: 24, risk: { score: 81, level: 'alto', factors: ['Possível cópia em massa de material protegido (87%)', 'Completude 100%'] }, reviewType: 'integral', reviewReason: 'Risco alto', assignedTo: 'adm1', decision: null, publicId: null, categoryId: 'superior', difficulty: 'dificil', cardCount: 42 },
      { id: 'pub4', deckId: 'x_d2', authorId: 'x7', authorName: 'Marcos V.', deckName: 'Matemática básica: frações', version: 2, status: 'em_triagem', plan: 'free', submittedAt: hoursFromNow(-50), decidedAt: null, slaHours: 72, risk: { score: 55, level: 'medio', factors: ['Duplicidade 92% com deck já publicado', 'Idioma consistente'] }, reviewType: 'amostral', reviewReason: 'Autor com histórico limpo', assignedTo: null, decision: null, publicId: null, categoryId: 'medio', difficulty: 'facil', cardCount: 18 },
      { id: 'pub5', deckId: 'x_d3', authorId: 'x8', authorName: 'Fernanda R.', deckName: 'Direito Penal resumido', version: 1, status: 'rejeitado', plan: 'free', submittedAt: daysFromNow(-8), decidedAt: daysFromNow(-6), slaHours: 72, risk: { score: 40, level: 'medio', factors: ['Termos técnicos sem fonte'] }, reviewType: 'integral', reviewReason: 'Primeiros 5 decks do autor', assignedTo: 'adm8', decision: { by: 'adm8', decision: 'rejeitado', reasonCategory: 'veracidade', excerpt: 'Card 7: "A prescrição da pretensão punitiva é imprescritível" contradiz o art. 109 do CP.' }, publicId: null, categoryId: 'concursos', difficulty: 'medio', cardCount: 25 }
    ],
    reports: [
      { id: 'rep1', targetType: 'deck', targetId: 'c6', targetName: 'Matemática Financeira para concursos', reason: 'Conteúdo incorreto', detail: 'Fórmula do desconto composto está errada no card 3.', reporter: 'x5', status: 'aberta', createdAt: daysFromNow(-1) },
      { id: 'rep2', targetType: 'comment', targetId: 'cm4', targetName: 'Comentário em "Direitos Fundamentais em 40 cards"', reason: 'Spam', detail: null, reporter: 'x9', status: 'auto_resolvida', createdAt: daysFromNow(-2) },
      { id: 'rep3', targetType: 'contato_suspeito', targetId: 'x11', targetName: 'Conta adulta "Ricardo M." em contato com aluno de 15 anos', reason: 'Nôa: padrão de contato suspeito de adulto com conta de menor', detail: '3 comentários direcionados ao mesmo aluno e pedido de contato externo em menos de 2 h.', reporter: 'noa', status: 'aberta', createdAt: hoursFromNow(-1), slaHours: 4, priority: 'alta' }
    ],
    appeals: [
      { id: 'ap1', publicationId: 'pub5', authorName: 'Fernanda R.', filedAt: daysFromNow(-5), deadline: daysFromNow(25), text: 'O card 7 foi corrigido; o texto original era um erro de digitação.', status: 'em_analise', reviewer: 'adm1', originalReviewer: 'adm8' }
    ],
    ledger: [],
    coupons: [
      { id: 'cp1', partnerId: 'p1', partnerName: 'Café Sinapse', title: '1 café coado', description: 'Um café coado grande em qualquer unidade.', costNeurons: 30, stock: 120, validityDays: 30, positioning: 'destaque', category: 'Alimentação', terms: 'Válido de segunda a sexta, não cumulativo.' },
      { id: 'cp2', partnerId: 'p2', partnerName: 'Papelaria Traço', title: '15% de desconto', description: 'Em qualquer compra acima de R$ 30.', costNeurons: 45, stock: 40, validityDays: 30, positioning: null, category: 'Papelaria', terms: 'Uma vez por CPF.' },
      { id: 'cp3', partnerId: 'p3', partnerName: 'Livraria Página Viva', title: 'R$ 20 de desconto', description: 'Em compras a partir de R$ 80, loja física ou online.', costNeurons: 60, stock: 1, validityDays: 30, positioning: null, category: 'Livros', terms: 'Não válido para livros didáticos em promoção.' },
      { id: 'cp4', partnerId: 'p4', partnerName: 'Lanchonete do Campus', title: 'Combo lanche + suco', description: 'Um combo do dia.', costNeurons: 40, stock: 0, validityDays: 15, positioning: null, category: 'Alimentação', terms: 'Sujeito a disponibilidade.' },
      { id: 'cp5', partnerId: 'p5', partnerName: 'StudyFlix', title: '1 mês grátis', description: 'Um mês de acesso às videoaulas.', costNeurons: 150, stock: 500, validityDays: 60, positioning: 'primeira_posicao', category: 'Educação', terms: 'Novos assinantes.' },
      { id: 'cp6', partnerId: 'p6', partnerName: 'Óptica Vista Clara', title: '10% em armações', description: 'Desconto em armações de grau.', costNeurons: 80, stock: 25, validityDays: 45, positioning: 'destaque', category: 'Saúde', terms: 'Não cumulativo.' }
    ],
    myCoupons: [
      { id: 'mc1', userId: 'u1', couponId: 'cp1', partnerName: 'Café Sinapse', title: '1 café coado', code: 'MEM-7K2P-91QX', redeemedAt: daysFromNow(-20), validUntil: daysFromNow(10), status: 'emitido', usedAt: null },
      { id: 'mc2', userId: 'u1', couponId: 'cp1', partnerName: 'Café Sinapse', title: '1 café coado', code: 'MEM-AA21-B9KD', redeemedAt: daysFromNow(-31), validUntil: daysFromNow(-1), status: 'expirado_reembolsado', usedAt: null },
      { id: 'mc3', userId: 'u1', couponId: 'cp1', partnerName: 'Café Sinapse', title: '1 café coado', code: 'MEM-8HNF-2C4V', redeemedAt: daysFromNow(-6), validUntil: daysFromNow(24), status: 'utilizado', usedAt: daysFromNow(-5) }
    ],
    reviews: [],
    study: {
      u1: {
        goal: 20,
        goalSuggested: 20,
        doneToday: 0,
        dayKey: dayKey(),
        goalHitDay: null,
        reschedules: { weekKey: weekKey(), used: 2, limit: 3 },
        skippedDay: null,
        pausedUntil: null,
        pausedAt: null,
        streak: 12,
        lastStudyDay: dayKey(daysFromNow(-1)),
        studyDays: 33,
        fatigueDetection: true,
        fatigueKeepLoadDay: null,
        planOrder: ['d1', 'd2', 'd3', 'd5'],
        planAdjustments: {}
      }
    },
    objectives: [
      { id: 'o1', userId: 'u1', name: 'ENEM', date: daysFromNow(23).slice(0, 10), subjects: ['Citologia'], outcome: null, outcomeRewarded: false, createdAt: daysFromNow(-20) },
      { id: 'o2', userId: 'u1', name: 'Prova de Cálculo I', date: daysFromNow(-2).slice(0, 10), subjects: ['Cálculo I'], outcome: null, outcomeRewarded: false, createdAt: daysFromNow(-25) },
      { id: 'o3', userId: 'u1', name: 'OAB 2027', date: daysFromNow(200).slice(0, 10), subjects: ['Direito Constitucional', 'Direito Administrativo'], outcome: null, outcomeRewarded: false, createdAt: daysFromNow(-10) }
    ],
    noa: {
      catalogVersion: 'v1.2',
      catalog: [
        { key: 'mark_difficult', name: 'Marcar deck como difícil', trigger: '3 erros seguidos em cards do mesmo deck', threshold: 3, effect: 'Marca o deck como difícil; as revisões dele ficam mais frequentes.', tokenCost: 120, autonomous: false, reversible: true, explanation: 'Você errou três vezes seguidas em cards deste deck na última sessão. Marcar como difícil faz o algoritmo trazer esses cards mais cedo. Você pode desmarcar a qualquer momento no menu do deck.' },
        { key: 'reorder_queue', name: 'Reordenar fila do dia', trigger: 'Deck com mais erros na semana não está no início da fila', threshold: 1, effect: 'Reordena a fila de hoje. Reversível em um toque.', tokenCost: 80, autonomous: true, reversible: true, explanation: 'Coloquei primeiro o deck em que você mais erra esta semana, porque a memória rende mais no início da sessão.' },
        { key: 'suggest_reinforcement', name: 'Propor deck de reforço', trigger: 'Mesmo tópico errado em 3 sessões diferentes', threshold: 3, effect: 'Gera uma sugestão de deck de reforço; nada é criado sem confirmação.', tokenCost: 400, autonomous: false, reversible: true, explanation: 'Você errou o mesmo tópico em três sessões. Um deck curto de reforço costuma resolver em uma semana.' },
        { key: 'adjust_goal', name: 'Ajustar meta sugerida', trigger: 'Meta batida em menos de 3 dos últimos 7 dias', threshold: 3, effect: 'Ajusta a meta sugerida; a meta configurada só muda se você aceitar.', tokenCost: 60, autonomous: true, reversible: true, explanation: 'Metas que raramente são batidas desmotivam. Sugeri um valor que você conseguiu manter nas últimas semanas.' },
        { key: 'reminder_time', name: 'Escolher horário do lembrete', trigger: 'Horário de uso real difere do lembrete em mais de 2 h', threshold: 2, effect: 'Move o lembrete para o horário em que você mais estuda. Reversível.', tokenCost: 40, autonomous: true, reversible: true, explanation: 'Você costuma estudar em outro horário. Movi o lembrete para ele; pode voltar em Configurações.' },
        { key: 'reduce_load', name: 'Reduzir carga por cansaço', trigger: 'Dois de três sinais de cansaço ativos', threshold: 2, effect: 'Reduz a carga da sessão atual. Você pode manter a carga normal com um toque.', tokenCost: 0, autonomous: true, reversible: true, explanation: 'Dois sinais de cansaço apareceram: tempo de resposta acima do dobro da sua média e taxa de erro 1,5× maior. Reduzi a sessão para proteger a retenção.' }
      ],
      budget: { u1: { dayKey: dayKey(), suggestionsUsed: 1, suggestionsLimit: 5, autonomousUsed: 1, autonomousLimit: 1 } },
      suggestions: [
        { id: 'sug1', userId: 'u1', actionKey: 'mark_difficult', deckId: 'd1', title: 'Marcar Direito Constitucional como difícil?', body: 'Você errou 3 vezes seguidas em "eficácia contida" e "cláusula pétrea". Marcando como difícil, as revisões ficam mais frequentes.', showAfterCard: 5, status: 'pendente', createdAt: nowIso() }
      ],
      decisions: [
        { id: 'dec1', userId: 'u1', actionKey: 'reorder_queue', at: hoursFromNow(-6), text: 'Reordenei sua fila de hoje para começar por Direito Constitucional, seu deck com mais erros esta semana.', reversible: true, reverted: false, contested: null },
        { id: 'dec2', userId: 'u1', actionKey: 'adjust_goal', at: daysFromNow(-3), text: 'Sugeri reduzir sua meta de 25 para 20 cards por dia, pois você bateu a meta em 2 dos últimos 7 dias.', reversible: true, reverted: false, contested: null, accepted: true },
        { id: 'dec3', userId: 'u1', actionKey: 'reminder_time', at: daysFromNow(-10), text: 'Movi seu lembrete de 21h para 19h, horário em que você mais estuda.', reversible: true, reverted: false, contested: null }
      ]
    },
    generation: {
      jobs: [],
      quota: { u1: { dayKey: dayKey(), used: 2 } },
      idempotency: {}
    },
    subscriptions: {},
    notifications: {
      u1: {
        intensity: 'padrao',
        reminderTime: '19:00',
        push: true,
        quietWindow: { start: '23:00', end: '07:30', learned: true, lockedForMinor: false },
        limits: { whatsappPerDay: 3, pushPerDay: 8 },
        sentToday: { whatsapp: 1, push: 3 }
      }
    },
    consents: {
      u1: {
        schoolShare: false,
        whatsapp: { lembretes: true, conquistas: false, conta: true, informativo: false },
        contentPolicyAcceptedVersion: null
      }
    },
    privacy: { exports: [], deletions: [] },
    support: {
      tickets: [
        { id: 'tk1', userId: 'u1', subject: 'Cupom não apareceu em Meus cupons', message: 'Resgatei um café e não vi o QR.', status: 'resolvido', createdAt: daysFromNow(-6), updatedAt: daysFromNow(-5), replies: [{ by: 'Beto Suporte', text: 'Oi, Manoel! O cupom estava em "Meus cupons" com o QR offline. Qualquer coisa, chama de novo.', at: daysFromNow(-5) }] }
      ]
    },
    auditLog: [],
    accessLog: [],
    parental: panels.parental,
    b2b: panels.b2b,
    admin: panels.admin,
    partner: panels.partner
  }

  seedLedger(state)
  applyProfile(state, profileKey)

  appendAudit(state, { actor: 'noa', actorRole: 'agent', action: 'reorder_queue', target: 'u1', details: { decisionId: 'dec1', reversible: true }, ts: hoursFromNow(-6) })
  appendAudit(state, { actor: 'adm8', actorRole: 'moderador', action: 'publication_rejected', target: 'pub5', details: { reasonCategory: 'veracidade' }, ts: daysFromNow(-6) })
  appendAudit(state, { actor: 'adm8', actorRole: 'moderador', action: 'publication_approved', target: 'pub1', details: {}, ts: daysFromNow(-15) })
  appendAudit(state, { actor: 'adm6', actorRole: 'compliance', action: 'incident_closed', target: 'inc1', details: { anpdNotified: true }, ts: daysFromNow(-30) })

  return state
}

export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
