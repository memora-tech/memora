import { isDue } from '../lib/fsrs.js'

export const DEFAULT_NOTIFICATIONS = {
  intensity: 'padrao',
  reminderTime: '19:00',
  push: true,
  quietWindow: { start: '23:00', end: '07:30', learned: true, lockedForMinor: false },
  limits: { whatsappPerDay: 3, pushPerDay: 8 },
  sentToday: { whatsapp: 0, push: 0 }
}

export const DEFAULT_PUBLIC_PROFILE = {
  level: 1,
  topic: 'Geral',
  points: 0,
  badges: [],
  cardsGenerated: 0,
  bio: ''
}

export const DEFAULT_CONSENTS = {
  schoolShare: false,
  whatsapp: { lembretes: true, conquistas: false, conta: true, informativo: false },
  contentPolicyAcceptedVersion: null,
  contentPolicyAcceptedAt: null
}

export const DEFAULT_SUBSCRIPTION_OFFER = {
  monthlyBRL: 29.9,
  yearlyBRL: 239.9,
  yearlyPerMonthBRL: 19.99
}

export function mapNotifications(raw) {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_NOTIFICATIONS)
  }
  return {
    intensity: raw.intensity || DEFAULT_NOTIFICATIONS.intensity,
    reminderTime: raw.reminderTime || DEFAULT_NOTIFICATIONS.reminderTime,
    push: typeof raw.push === 'boolean' ? raw.push : DEFAULT_NOTIFICATIONS.push,
    quietWindow: {
      ...DEFAULT_NOTIFICATIONS.quietWindow,
      ...(raw.quietWindow || {})
    },
    limits: {
      ...DEFAULT_NOTIFICATIONS.limits,
      ...(raw.limits || {})
    },
    sentToday: {
      ...DEFAULT_NOTIFICATIONS.sentToday,
      ...(raw.sentToday || {})
    }
  }
}

export function mapConsentsRow(row) {
  if (!row) {
    return structuredClone(DEFAULT_CONSENTS)
  }
  return {
    schoolShare: Boolean(row.school_share ?? row.schoolShare ?? false),
    whatsapp: {
      ...DEFAULT_CONSENTS.whatsapp,
      ...(row.whatsapp || {})
    },
    contentPolicyAcceptedVersion:
      row.content_policy_accepted_version ?? row.contentPolicyAcceptedVersion ?? null,
    contentPolicyAcceptedAt:
      row.content_policy_accepted_at ?? row.contentPolicyAcceptedAt ?? null
  }
}

export function mapProfileToUser(row, studyRow = null, balance = 0) {
  if (!row) return null
  return {
    id: row.id,
    role: row.role || 'student',
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    birthDate: row.birth_date ?? row.birthDate,
    isMinor: false,
    guardianId: null,
    isStudent: row.is_student !== false,
    origin: row.origin || null,
    plan: row.plan || 'free',
    locale: row.locale || 'pt-BR',
    timezone: row.timezone || 'America/Sao_Paulo',
    verified: { email: true, phone: Boolean(row.phone) },
    canEarn: true,
    ageVerification: {
      status: 'aprovado',
      method: 'cadastro_maior_18',
      provider: 'Supabase Auth'
    },
    createdAt: row.created_at ?? row.createdAt,
    deactivatedAt: row.deactivated_at ?? row.deactivatedAt ?? null,
    publicProfile: {
      ...DEFAULT_PUBLIC_PROFILE,
      ...(row.public_profile || row.publicProfile || {})
    },
    settings: row.settings || {},
    notifications: mapNotifications(row.notifications),
    guardianPermissions: null,
    streak: studyRow?.streak ?? row.streak ?? 0,
    studyDays: studyRow?.study_days ?? studyRow?.studyDays ?? row.studyDays ?? 0,
    balance: typeof balance === 'number' ? balance : 0,
    onboardingDone: Boolean(row.onboarding_done ?? row.onboardingDone),
    onboarding: row.onboarding_data || row.onboarding || {}
  }
}

export function mapStudySettingsRow(row) {
  if (!row) return null
  return {
    userId: row.user_id,
    goal: Number(row.goal ?? 20),
    goalSuggested: Number(row.goal_suggested ?? 20),
    doneToday: Number(row.done_today ?? 0),
    dayKey: row.day_key,
    goalHitDay: row.goal_hit_day || null,
    streak: Number(row.streak ?? 0),
    studyDays: Number(row.study_days ?? 0),
    lastStudyDay: row.last_study_day || null,
    lastStudyAt: row.last_study_at || null,
    skippedDay: row.skipped_day || null,
    reschedules: {
      weekKey: row.reschedules_week_key,
      used: Number(row.reschedules_used ?? 0),
      limit: Number(row.reschedules_limit ?? 3)
    },
    pausedUntil: row.paused_until || null,
    pausedAt: row.paused_at || null,
    fatigueDetection: row.fatigue_detection !== false,
    fatigueKeepLoadDay: row.fatigue_keep_load_day || null,
    planOrder: Array.isArray(row.plan_order) ? row.plan_order : [],
    planAdjustments: row.plan_adjustments || {},
    communityAnswered: row.community_answered || {}
  }
}

export function mapLedgerRow(row) {
  if (!row) return null
  return {
    id: row.id,
    ts: row.created_at || row.ts,
    userId: row.user_id || row.userId,
    amount: Number(row.amount),
    type: row.type,
    meta: row.meta || {},
    balanceAfter: Number(row.balance_after ?? row.balanceAfter ?? 0),
    ...(row.idempotency_key ? { idempotencyKey: row.idempotency_key } : {})
  }
}

export function mapWalletSummary({ user, balance = 0, ledger = [], studyDays = null }) {
  const resolvedStudyDays =
    typeof studyDays === 'number' ? studyDays : Number(user?.studyDays ?? 0)
  const verified = Boolean(user?.verified?.email)
  return {
    balance: Number(balance),
    ledger,
    redeemable: false,
    redeemableCount: 0,
    nextCoupon: null,
    cheapest: null,
    canRedeem: {
      ok: false,
      studyDays: resolvedStudyDays,
      required: 10,
      verified
    },
    abuseFlag: false,
    myCoupons: [],
    referral: verified
      ? {
          code: `MEM-${String(user?.name || 'MEMORA')
            .toUpperCase()
            .replace(/\s+/g, '')
            .slice(0, 6)}`,
          bonus: 20,
          rule: 'O indicado precisa concluir a verificação e estudar em ao menos 3 dos primeiros 7 dias. Indicações do mesmo aparelho ou IP não pontuam.'
        }
      : null,
    rules: {
      dailyAccess: 1,
      goalBonus: 5,
      neverPurchasable: true,
      expiryRefund: true
    }
  }
}

export function mapCardRow(row) {
  if (!row) return null
  return {
    id: row.id,
    deckId: row.deck_id ?? row.deckId,
    type: row.type || 'text',
    front: row.front,
    back: row.back,
    media: row.media || null,
    lang: row.lang || 'pt-BR',
    origin: row.origin || { document: 'Criado manualmente' },
    uncertain: Boolean(row.uncertain),
    position: Number(row.position ?? 0),
    sched: row.sched || {
      state: row.sched_state || 'new',
      stability: Number(row.sched_stability ?? 0),
      difficulty: Number(row.sched_difficulty ?? 5),
      due: row.sched_due || row.created_at,
      lastReview: row.sched_last_review || null,
      reps: Number(row.sched_reps ?? 0),
      lapses: Number(row.sched_lapses ?? 0),
      consecutiveLapses: Number(row.sched_consecutive_lapses ?? 0)
    },
    editedAt: row.edited_at ?? row.editedAt ?? null,
    deletedAt: row.deleted_at ?? row.deletedAt ?? null,
    createdAt: row.created_at ?? row.createdAt
  }
}

export function mapDeckRow(row, cards = [], categoryMap = {}) {
  if (!row) return null
  const activeCards = cards.filter((c) => !c.deletedAt && !c.deleted_at).map(mapCardRow)
  const due = activeCards.filter((c) => isDue(c.sched)).length
  const mastered = activeCards.filter((c) => (c.sched?.stability || 0) >= 21).length
  const lastStudiedAt = row.last_studied_at ?? row.lastStudiedAt ?? null
  const pinned = Boolean(row.pinned)
  const recent =
    lastStudiedAt && new Date(lastStudiedAt).getTime() >= Date.now() - 7 * 86400000
  const categoryId = row.category_id ?? row.categoryId ?? 'outros'

  return {
    id: row.id,
    ownerId: row.owner_id ?? row.ownerId,
    folderId: row.folder_id ?? row.folderId ?? null,
    name: row.name,
    categoryId,
    categoryName: categoryMap[categoryId] || 'Outros',
    tags: Array.isArray(row.tags) ? row.tags : [],
    difficulty: row.difficulty || 'medio',
    lang: row.lang || 'pt-BR',
    scheduled: row.scheduled !== false,
    difficult: Boolean(row.difficult),
    focus: Boolean(row.focus),
    complementary: Boolean(row.complementary),
    pinned,
    favorite: Boolean(row.favorite),
    source: row.source || { type: 'vazio', document: null, pages: null },
    clonedFrom: row.cloned_from ?? row.clonedFrom ?? null,
    publication: row.publication_meta ?? row.publication ?? { status: 'nao_publicado' },
    lastStudiedAt,
    createdAt: row.created_at ?? row.createdAt,
    cardCount: activeCards.length,
    progress: {
      total: activeCards.length,
      due,
      mastered,
      learning: activeCards.length - mastered,
      offlineAvailable: Boolean(recent || pinned),
      offlineReason: pinned ? 'fixado' : recent ? 'recente' : null
    }
  }
}

export function mapObjectiveRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    name: row.name,
    date: row.target_date ?? row.date,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    priority: Boolean(row.priority),
    outcome: row.outcome || null,
    outcomeAt: row.outcome_at ?? row.outcomeAt ?? null,
    outcomeRewarded: Boolean(row.outcome_rewarded ?? row.outcomeRewarded),
    createdAt: row.created_at ?? row.createdAt
  }
}

export function mapGenerationJobRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    plan: row.plan || 'free',
    source: row.source || 'file',
    documentName: row.document_name ?? row.documentName ?? 'documento.pdf',
    storagePath: row.storage_path ?? row.storagePath ?? null,
    textPreview: row.text_preview ?? row.textPreview ?? '',
    sizeTokens: Number(row.size_tokens ?? row.sizeTokens ?? 0),
    pages: Number(row.pages ?? 1),
    legibility: row.legibility || 'ok',
    idempotencyKey: row.idempotency_key ?? row.idempotencyKey ?? null,
    createdAt: row.created_at ?? row.createdAt,
    status: row.status || 'criado',
    queuePosition: row.queue_position ?? row.queuePosition ?? null,
    attempt: Number(row.attempt ?? 1),
    tokensBudget: row.tokens_budget ?? row.tokensBudget ?? {},
    scope: row.scope || null,
    overBudget: row.over_budget ?? row.overBudget ?? null,
    readerModel: row.reader_model ?? row.readerModel ?? null,
    generatorModel: row.generator_model ?? row.generatorModel ?? null,
    quotaRefunded: Boolean(row.quota_refunded ?? row.quotaRefunded),
    result: row.result || null,
    approvedDeckId: row.approved_deck_id ?? row.approvedDeckId ?? null,
    readyAt: row.ready_at ?? row.readyAt ?? null,
    failedAt: row.failed_at ?? row.failedAt ?? null
  }
}

export function mapNoaSuggestionRow(row) {
  if (!row) return null
  const payload = row.payload || {}
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    actionKey: row.action_key ?? row.actionKey,
    deckId: row.deck_id ?? row.deckId ?? null,
    title: row.title,
    body: row.body,
    payload,
    ...(payload.showAfterCard !== undefined || row.showAfterCard !== undefined
      ? { showAfterCard: payload.showAfterCard ?? row.showAfterCard }
      : {}),
    ...(payload.goal !== undefined || row.goal !== undefined
      ? { goal: payload.goal ?? row.goal }
      : {}),
    status: row.status || 'pendente',
    feedback: row.feedback || null,
    respondedAt: row.responded_at ?? row.respondedAt ?? null,
    createdAt: row.created_at ?? row.createdAt
  }
}

export function mapNoaDecisionRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    actionKey: row.action_key ?? row.actionKey,
    at: row.created_at ?? row.at,
    text: row.text,
    reversible: row.reversible !== false,
    reverted: Boolean(row.reverted),
    revertedAt: row.reverted_at ?? row.revertedAt ?? null,
    accepted: typeof row.accepted === 'boolean' ? row.accepted : null,
    previousState: row.previous_state ?? row.previousState ?? null,
    contested: row.contested || null
  }
}
