import { isDue, schedule } from '../lib/fsrs.js'
import { PLAN_LIMITS } from '../lib/helpers.js'
import { dayKey, daysFromNow, nowIso } from '../lib/ids.js'
import { weekKey } from '../seed/index.js'
import { CATEGORY_MAP } from './decks.repo.js'
import { mapCardRow, mapDeckRow, mapObjectiveRow, mapStudySettingsRow } from './mappers.js'

const SECONDS_PER_CARD = 20

function inferSubjectsFromDecks(decks, name) {
  const lower = (name || '').toLowerCase()
  let picked = []
  if (/enem|vestibular|fuvest|unicamp/.test(lower)) {
    picked = decks.filter((d) => d.categoryId === 'vestibular')
  } else if (/oab|concurso|trf|tribunal|inss|banco/.test(lower)) {
    picked = decks.filter((d) => d.categoryId === 'concursos')
  } else if (/ingl|toefl|ielts|espanhol|idioma/.test(lower)) {
    picked = decks.filter((d) => d.categoryId === 'idiomas')
  } else {
    picked = decks.filter(
      (d) => d.lastStudiedAt && new Date(d.lastStudiedAt).getTime() > Date.now() - 7 * 86400000
    )
  }
  return picked.map((d) => d.name)
}

export function createStudyRepo() {
  return {
    async ensureDay(db, user) {
      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      const yesterday = dayKey(daysFromNow(-1), tz)
      const currentWeek = weekKey()

      let { data: row, error } = await db
        .from('study_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error

      if (!row) {
        const defaultRow = {
          user_id: user.id,
          goal: 20,
          goal_suggested: 20,
          done_today: 0,
          day_key: today,
          goal_hit_day: null,
          streak: user.streak ?? 0,
          study_days: user.studyDays ?? 0,
          last_study_day: null,
          last_study_at: null,
          skipped_day: null,
          reschedules_week_key: currentWeek,
          reschedules_used: 0,
          reschedules_limit: 3,
          paused_until: null,
          paused_at: null,
          fatigue_detection: true,
          fatigue_keep_load_day: null,
          plan_order: [],
          plan_adjustments: {},
          community_answered: {}
        }
        const { data: inserted, error: insertErr } = await db
          .from('study_settings')
          .insert(defaultRow)
          .select('*')
          .maybeSingle()
        if (insertErr) throw insertErr
        row = inserted || defaultRow
      }

      const patch = {}
      if (row.day_key !== today) {
        patch.day_key = today
        patch.done_today = 0
        if (
          row.last_study_day &&
          row.last_study_day !== yesterday &&
          row.last_study_day !== today &&
          row.skipped_day !== yesterday
        ) {
          patch.streak = 0
        }
      }
      if (row.reschedules_week_key !== currentWeek) {
        patch.reschedules_week_key = currentWeek
        patch.reschedules_used = 0
        patch.reschedules_limit = 3
      }

      if (Object.keys(patch).length > 0) {
        const { data: updated, error: updateErr } = await db
          .from('study_settings')
          .update(patch)
          .eq('user_id', user.id)
          .select('*')
          .maybeSingle()
        if (updateErr) throw updateErr
        row = updated || { ...row, ...patch }
      }

      return {
        today,
        yesterday,
        tz,
        row,
        settings: mapStudySettingsRow(row)
      }
    },

    async todaySession(db, user, ledgerRepo = null) {
      const { today, tz, settings: s } = await this.ensureDay(db, user)

      const [
        { data: deckRows, error: deckErr },
        { data: cardRows, error: cardErr },
        { data: objRows, error: objErr },
        { data: sugRows, error: sugErr },
        { data: budgetRow, error: budgetErr },
        { data: revRows, error: revErr },
        balance
      ] = await Promise.all([
        db
          .from('decks')
          .select('*')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        db
          .from('cards')
          .select('*')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
          .order('position', { ascending: true }),
        db
          .from('objectives')
          .select('*')
          .eq('user_id', user.id)
          .order('target_date', { ascending: true }),
        db
          .from('noa_suggestions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        db
          .from('noa_daily_budget')
          .select('*')
          .eq('user_id', user.id)
          .eq('day_key', today)
          .maybeSingle(),
        db
          .from('reviews')
          .select('*')
          .eq('user_id', user.id)
          .order('reviewed_at', { ascending: false })
          .limit(20),
        ledgerRepo ? ledgerRepo.getBalance(db, user.id) : Promise.resolve(Number(user.balance ?? 0))
      ])
      if (deckErr) throw deckErr
      if (cardErr) throw cardErr
      if (objErr) throw objErr
      if (sugErr) throw sugErr
      if (budgetErr) throw budgetErr
      if (revErr) throw revErr

      const cardsByDeck = {}
      const mappedCards = (cardRows || []).map(mapCardRow)
      for (const c of mappedCards) {
        if (!cardsByDeck[c.deckId]) cardsByDeck[c.deckId] = []
        cardsByDeck[c.deckId].push(c)
      }

      const allDecks = (deckRows || []).map((r) =>
        mapDeckRow(r, cardsByDeck[r.id] || [], CATEGORY_MAP)
      )
      const decks = allDecks.filter((d) => d.scheduled !== false)
      const dueCards = mappedCards
        .filter((c) => decks.some((d) => d.id === c.deckId) && isDue(c.sched))
        .map((c) => ({ ...c, deckName: decks.find((d) => d.id === c.deckId)?.name }))

      const order = [
        ...s.planOrder,
        ...decks.map((d) => d.id).filter((dId) => !s.planOrder.includes(dId))
      ]
      const grouped = order
        .map((deckId) => {
          const deck = decks.find((d) => d.id === deckId)
          if (!deck) return null
          const available = dueCards.filter((c) => c.deckId === deckId)
          if (!available.length) return null
          const adjusted = s.planAdjustments[deckId]
          const count =
            typeof adjusted === 'number' ? Math.min(adjusted, available.length) : available.length
          return {
            deckId,
            deckName: deck.name,
            available: available.length,
            count,
            difficult: deck.difficult,
            focus: deck.focus,
            complementary: deck.complementary,
            cards: available.slice(0, count)
          }
        })
        .filter(Boolean)

      const focusFirst = grouped
        .slice()
        .sort(
          (a, b) => Number(b.focus) - Number(a.focus) || Number(b.difficult) - Number(a.difficult)
        )
      const cards = focusFirst.flatMap((g) => g.cards)
      const total = cards.length
      const skippedToday = s.skippedDay === today
      const paused = Boolean(s.pausedUntil && new Date(s.pausedUntil).getTime() > Date.now())

      const objectives = (objRows || []).map(mapObjectiveRow)
      const upcoming = objectives
        .filter((o) => o.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || Number(b.priority) - Number(a.priority))
      const nearest = upcoming[0]
        ? {
            ...upcoming[0],
            daysLeft: Math.round((new Date(upcoming[0].date) - new Date(today)) / 86400000),
            tie: upcoming.filter((o) => o.date === upcoming[0].date).length > 1
          }
        : null
      const pendingOutcome = objectives.find((o) => o.date < today && !o.outcome) || null

      const suggestions = (sugRows || []).map((g) => ({
        id: g.id,
        userId: g.user_id ?? g.userId,
        actionKey: g.action_key ?? g.actionKey,
        deckId: g.deck_id ?? g.deckId ?? null,
        title: g.title,
        body: g.body,
        payload: g.payload || {},
        status: g.status || 'pendente',
        feedback: g.feedback || null,
        respondedAt: g.responded_at ?? g.respondedAt ?? null,
        createdAt: g.created_at ?? g.createdAt
      }))
      const suggestion = suggestions.find((g) => g.status === 'pendente') || null
      const suggestionsToday = suggestions.filter((g) => dayKey(g.createdAt, tz) === today).length
      const noaBudget = {
        dayKey: today,
        suggestionsUsed: suggestionsToday,
        suggestionsLimit: Number(budgetRow?.suggestions_limit ?? 5),
        autonomousUsed: Number(budgetRow?.autonomous_used ?? 0),
        autonomousLimit: Number(budgetRow?.autonomous_limit ?? 1)
      }

      const limits = PLAN_LIMITS[user.plan || 'free'] || PLAN_LIMITS.free
      const recentDeckIds = decks.filter((d) => d.progress.offlineAvailable).map((d) => d.id)
      const minutes = Math.max(1, Math.ceil((total * SECONDS_PER_CARD) / 60))

      const historyWithDuration = (revRows || [])
        .map((r) => ({
          durationMs: r.duration_ms ?? r.durationMs ?? null,
          rating: r.rating
        }))
        .filter((r) => r.durationMs)
        .slice(0, 20)
      const personal = historyWithDuration.length
        ? {
            sample: historyWithDuration.length,
            avgMs: Math.round(
              historyWithDuration.reduce((n, r) => n + Number(r.durationMs), 0) /
                historyWithDuration.length
            ),
            errorRate: Number(
              (
                historyWithDuration.filter((r) => r.rating === 'again').length /
                historyWithDuration.length
              ).toFixed(2)
            )
          }
        : null

      return {
        date: today,
        status: paused
          ? 'pausado'
          : skippedToday
            ? 'reagendado'
            : total === 0 && s.doneToday > 0
              ? 'concluido'
              : total === 0
                ? 'sem_cards'
                : 'pronto',
        goal: s.goal,
        goalSuggested: s.goalSuggested,
        doneToday: s.doneToday,
        goalHitToday: s.goalHitDay === today,
        cardsDue: total,
        estimatedMinutes: minutes,
        plan: focusFirst.map(({ cards: _c, ...g }) => g),
        scheduledDecks: decks.map((d) => {
          const deckCards = cardsByDeck[d.id] || []
          const upcomingDue =
            deckCards
              .filter((c) => !isDue(c.sched))
              .map((c) => c.sched.due)
              .sort()[0] || null
          const planned = grouped.find((g) => g.deckId === d.id)
          return {
            id: d.id,
            name: d.name,
            categoryName: d.categoryName,
            difficulty: d.difficulty,
            difficult: d.difficult,
            focus: d.focus,
            total: d.progress.total,
            mastered: d.progress.mastered,
            dueNow: d.progress.due,
            today: planned ? planned.count : 0,
            nextDue: upcomingDue,
            lastStudiedAt: d.lastStudiedAt
          }
        }),
        unscheduledCount: allDecks.length - decks.length,
        cards,
        streak: s.streak,
        reschedules: s.reschedules,
        pausedUntil: paused ? s.pausedUntil : null,
        nearestObjective: nearest,
        pendingOutcome,
        objectivesCount: objectives.length,
        noaSuggestion:
          suggestion && suggestionsToday <= noaBudget.suggestionsLimit ? suggestion : null,
        noaBudget,
        fatigue: {
          enabled: s.fatigueDetection,
          keepLoadToday: s.fatigueKeepLoadDay === today,
          signals: {
            responseTimeFactor: 2,
            errorRateFactor: 1.5,
            sessionMinutes: 45,
            required: 2,
            window: 20
          },
          personal
        },
        offline: { recentDeckIds, pinLimit: limits.pinLimit, recentDays: 7 },
        balance,
        timezone: tz
      }
    },

    async submitReviews(db, user, rawReviews = [], ledgerRepo = null) {
      const { today, yesterday, tz, settings: s } = await this.ensureDay(db, user)
      const reviews = Array.isArray(rawReviews) ? rawReviews : []

      const [{ data: existingRevRows, error: revErr }, { data: cardRows, error: cardErr }] =
        await Promise.all([
          db.from('reviews').select('client_id').eq('user_id', user.id),
          db.from('cards').select('*').eq('owner_id', user.id).is('deleted_at', null)
        ])
      if (revErr) throw revErr
      if (cardErr) throw cardErr

      const seenClientIds = new Set(
        (existingRevRows || []).map((r) => r.client_id ?? r.clientId).filter(Boolean)
      )
      const cardById = new Map((cardRows || []).map((c) => [c.id, c]))

      const accepted = []
      const duplicates = []
      const rewards = []
      const flagged = []
      const communityAnswered = { ...(s.communityAnswered || {}) }

      for (const rv of reviews) {
        if (!rv.clientId || !rv.cardId || !rv.rating) continue
        if (seenClientIds.has(rv.clientId)) {
          duplicates.push(rv.clientId)
          continue
        }
        seenClientIds.add(rv.clientId)

        const reviewedAt = rv.reviewedAt || nowIso()
        const skewHours = Math.abs(new Date(reviewedAt).getTime() - Date.now()) / 3600000
        const plausible = skewHours <= 24

        const cardRow = cardById.get(rv.cardId) || null
        let deckId = cardRow ? cardRow.deck_id ?? cardRow.deckId : rv.deckId || null
        if (!deckId) {
          deckId = rv.cardId.includes('_c')
            ? rv.cardId.split('_c')[0]
            : rv.cardId.startsWith('pub_')
              ? rv.cardId.split('_').slice(0, 2).join('_')
              : rv.cardId.split('_')[0]
        }

        const { error: insertRevErr } = await db.from('reviews').insert({
          client_id: rv.clientId,
          user_id: user.id,
          card_id: cardRow ? cardRow.id : null,
          community_card_ref: cardRow ? null : rv.cardId,
          deck_id: deckId,
          rating: rv.rating,
          duration_ms: rv.durationMs || null,
          offline: Boolean(rv.offline),
          plausible,
          reviewed_at: reviewedAt,
          received_at: nowIso()
        })
        if (insertRevErr) throw insertRevErr

        accepted.push(rv.clientId)
        if (!plausible) flagged.push(rv.clientId)

        if (cardRow) {
          const currentCard = mapCardRow(cardRow)
          const nextSched = schedule(currentCard.sched, rv.rating, reviewedAt)
          cardRow.sched_state = nextSched.state
          cardRow.sched_stability = nextSched.stability
          cardRow.sched_difficulty = nextSched.difficulty
          cardRow.sched_due = nextSched.due
          cardRow.sched_last_review = nextSched.lastReview
          cardRow.sched_reps = nextSched.reps
          cardRow.sched_lapses = nextSched.lapses
          cardRow.sched_consecutive_lapses = nextSched.consecutiveLapses

          const [{ error: updCardErr }, { error: updDeckErr }] = await Promise.all([
            db
              .from('cards')
              .update({
                sched_state: nextSched.state,
                sched_stability: nextSched.stability,
                sched_difficulty: nextSched.difficulty,
                sched_due: nextSched.due,
                sched_last_review: nextSched.lastReview,
                sched_reps: nextSched.reps,
                sched_lapses: nextSched.lapses,
                sched_consecutive_lapses: nextSched.consecutiveLapses
              })
              .eq('id', cardRow.id)
              .eq('owner_id', user.id),
            db
              .from('decks')
              .update({ last_studied_at: reviewedAt })
              .eq('id', deckId)
              .eq('owner_id', user.id)
          ])
          if (updCardErr) throw updCardErr
          if (updDeckErr) throw updDeckErr
        } else {
          communityAnswered[deckId] = (communityAnswered[deckId] || 0) + 1
        }

        s.doneToday += 1
        const reviewDay = plausible ? dayKey(reviewedAt, tz) : today
        const gapOk =
          !s.lastStudyAt ||
          new Date(reviewedAt).getTime() - new Date(s.lastStudyAt).getTime() >= 20 * 3600000
        if (s.lastStudyDay !== reviewDay && gapOk) {
          if (s.lastStudyDay === yesterday || s.skippedDay === yesterday || !s.lastStudyDay) {
            s.streak += 1
          } else if (s.lastStudyDay !== today) {
            s.streak = 1
          }
          s.lastStudyDay = reviewDay
          s.studyDays += 1
          s.lastStudyAt = reviewedAt
        }
      }

      if (
        s.doneToday >= s.goal &&
        s.goalHitDay !== today &&
        !user.deactivatedAt &&
        user.verified?.email &&
        ledgerRepo
      ) {
        s.goalHitDay = today
        const reward = await ledgerRepo.credit(
          user.id,
          5,
          'goal_bonus',
          { goal: s.goal, day: today },
          `goal_bonus:${today}`
        )
        if (reward) rewards.push(reward)
      }

      const { error: saveStudyErr } = await db
        .from('study_settings')
        .update({
          done_today: s.doneToday,
          goal_hit_day: s.goalHitDay,
          streak: s.streak,
          study_days: s.studyDays,
          last_study_day: s.lastStudyDay,
          last_study_at: s.lastStudyAt,
          community_answered: communityAnswered
        })
        .eq('user_id', user.id)
      if (saveStudyErr) throw saveStudyErr

      const balance = ledgerRepo
        ? await ledgerRepo.getBalance(db, user.id)
        : Number(user.balance ?? 0)

      return {
        accepted,
        duplicates,
        flagged,
        doneToday: s.doneToday,
        goal: s.goal,
        goalHitToday: s.goalHitDay === today,
        streak: s.streak,
        studyDays: s.studyDays,
        rewards,
        balance
      }
    },

    async completeSession(db, user, ledgerRepo = null) {
      const session = await this.todaySession(db, user, ledgerRepo)
      const tz = session.timezone
      const today = session.date

      const [{ data: revRows, error: revErr }, ledgerEntries] = await Promise.all([
        db.from('reviews').select('*').eq('user_id', user.id),
        ledgerRepo ? ledgerRepo.listEntries(db, user.id) : Promise.resolve([])
      ])
      if (revErr) throw revErr

      const todays = (revRows || []).filter(
        (x) => dayKey(x.reviewed_at ?? x.reviewedAt, tz) === today
      )
      const correct = todays.filter((x) => x.rating === 'good' || x.rating === 'easy').length
      const earnedToday = (ledgerEntries || []).filter(
        (e) => e.amount > 0 && dayKey(e.ts, tz) === today
      )

      return {
        cardsReviewed: session.doneToday,
        accuracy: todays.length ? Math.round((correct / todays.length) * 100) : null,
        streak: session.streak,
        goal: session.goal,
        goalHit: session.goalHitToday,
        neuronsEarnedToday: earnedToday.reduce((n, e) => n + e.amount, 0),
        earnedEntries: earnedToday,
        balance: session.balance,
        pendingOutcome: session.pendingOutcome,
        remainingDue: session.cardsDue
      }
    },

    async skipToday(db, user, ledgerRepo = null) {
      const { today, settings: s } = await this.ensureDay(db, user)
      if (s.reschedules.used >= s.reschedules.limit) {
        return { limitError: s.reschedules }
      }
      const nextUsed = s.reschedules.used + 1
      const { error } = await db
        .from('study_settings')
        .update({
          reschedules_used: nextUsed,
          skipped_day: today
        })
        .eq('user_id', user.id)
      if (error) throw error
      const session = await this.todaySession(db, user, ledgerRepo)
      return { session, used: nextUsed }
    },

    async undoSkipToday(db, user, ledgerRepo = null) {
      const { today, settings: s } = await this.ensureDay(db, user)
      if (s.skippedDay === today) {
        const nextUsed = Math.max(0, s.reschedules.used - 1)
        const { error } = await db
          .from('study_settings')
          .update({
            skipped_day: null,
            reschedules_used: nextUsed
          })
          .eq('user_id', user.id)
        if (error) throw error
      }
      return this.todaySession(db, user, ledgerRepo)
    },

    async pauseGoal(db, user, days, ledgerRepo = null) {
      await this.ensureDay(db, user)
      const { error } = await db
        .from('study_settings')
        .update({
          paused_until: daysFromNow(days, 6),
          paused_at: nowIso()
        })
        .eq('user_id', user.id)
      if (error) throw error
      return this.todaySession(db, user, ledgerRepo)
    },

    async resumeGoal(db, user, ledgerRepo = null) {
      const { settings: s } = await this.ensureDay(db, user)
      const pausedDays = s.pausedAt
        ? Math.max(1, Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 86400000))
        : 0

      const { error: clearErr } = await db
        .from('study_settings')
        .update({
          paused_until: null,
          paused_at: null
        })
        .eq('user_id', user.id)
      if (clearErr) throw clearErr

      const before = await this.todaySession(db, user, ledgerRepo)
      let summary = null
      let finalSession = before
      if (pausedDays >= 3) {
        const adjustments = Object.fromEntries(
          before.plan.map((p) => [p.deckId, Math.max(1, Math.ceil(p.available / 2))])
        )
        const { error: adjErr } = await db
          .from('study_settings')
          .update({ plan_adjustments: adjustments })
          .eq('user_id', user.id)
        if (adjErr) throw adjErr
        finalSession = await this.todaySession(db, user, ledgerRepo)
        summary = {
          pausedDays,
          cardsWaiting: before.cardsDue,
          cardsToday: finalSession.cardsDue,
          decks: before.plan.map((p) => p.deckName),
          message: `Você ficou ${pausedDays} dias fora. ${before.cardsDue} cards esperam por você em ${before.plan.length} decks. Vamos com calma: deixei ${finalSession.cardsDue} para hoje, metade de cada deck.`
        }
      }
      return { session: finalSession, summary }
    },

    async updateGoal(db, user, goal, ledgerRepo = null) {
      await this.ensureDay(db, user)
      const { error } = await db
        .from('study_settings')
        .update({ goal })
        .eq('user_id', user.id)
      if (error) throw error
      return this.todaySession(db, user, ledgerRepo)
    },

    async updatePlan(db, user, body = {}, ledgerRepo = null) {
      const { settings: s } = await this.ensureDay(db, user)
      const patch = {}
      if (Array.isArray(body.order)) patch.plan_order = body.order
      if (body.adjustments && typeof body.adjustments === 'object') {
        patch.plan_adjustments = { ...(s.planAdjustments || {}), ...body.adjustments }
      }
      if (body.reset) patch.plan_adjustments = {}

      if (Object.keys(patch).length > 0) {
        const { error } = await db
          .from('study_settings')
          .update(patch)
          .eq('user_id', user.id)
        if (error) throw error
      }
      return this.todaySession(db, user, ledgerRepo)
    },

    async recordFatigue(db, user, body = {}) {
      const { today, settings: s } = await this.ensureDay(db, user)
      const patch = {}
      if (body.keepLoad) patch.fatigue_keep_load_day = today
      if (typeof body.enabled === 'boolean') patch.fatigue_detection = body.enabled

      if (Object.keys(patch).length > 0) {
        const { error } = await db
          .from('study_settings')
          .update(patch)
          .eq('user_id', user.id)
        if (error) throw error
      }
      const enabled =
        typeof body.enabled === 'boolean' ? body.enabled : Boolean(s.fatigueDetection)
      const keepLoadDay = body.keepLoad ? today : s.fatigueKeepLoadDay
      return {
        fatigueDetection: enabled,
        keepLoadToday: keepLoadDay === today
      }
    },

    async getHistory(db, user) {
      const [
        { data: revRows, error: revErr },
        { data: deckRows, error: deckErr },
        { data: pubRows, error: pubErr }
      ] = await Promise.all([
        db
          .from('reviews')
          .select('*')
          .eq('user_id', user.id)
          .order('reviewed_at', { ascending: false }),
        db.from('decks').select('*').eq('owner_id', user.id),
        db
          .from('deck_publications')
          .select('*')
          .eq('status', 'aprovado')
          .is('hidden_at', null)
      ])
      if (revErr) throw revErr
      if (deckErr) throw deckErr
      if (pubErr) throw pubErr

      const ownDecksById = new Map((deckRows || []).map((d) => [d.id, d]))
      const pubDecksById = new Map((pubRows || []).map((p) => [p.id, p]))
      const byDeck = new Map()

      for (const rv of revRows || []) {
        const deckId = rv.deck_id ?? rv.deckId
        if (!deckId) continue
        const reviewedAt = rv.reviewed_at ?? rv.reviewedAt
        const entry = byDeck.get(deckId) || { deckId, reviews: 0, lastAt: null }
        entry.reviews += 1
        if (!entry.lastAt || reviewedAt > entry.lastAt) entry.lastAt = reviewedAt
        byDeck.set(deckId, entry)
      }

      for (const d of deckRows || []) {
        const deletedAt = d.deleted_at ?? d.deletedAt
        const lastStudiedAt = d.last_studied_at ?? d.lastStudiedAt
        if (!deletedAt && lastStudiedAt) {
          const entry = byDeck.get(d.id) || { deckId: d.id, reviews: 0, lastAt: null }
          if (!entry.lastAt || lastStudiedAt > entry.lastAt) entry.lastAt = lastStudiedAt
          byDeck.set(d.id, entry)
        }
      }

      const items = Array.from(byDeck.values())
        .map((e) => {
          const own = ownDecksById.get(e.deckId)
          const community = pubDecksById.get(e.deckId)
          if (!own && !community) return null
          return {
            ...e,
            kind: own ? 'own' : 'community',
            name: (own || community).name,
            authorName: community ? community.author_name ?? community.authorName ?? null : null,
            categoryId:
              (own || community).category_id ?? (own || community).categoryId ?? 'outros',
            deleted: Boolean(own?.deleted_at ?? own?.deletedAt)
          }
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))

      const created = (deckRows || [])
        .filter((d) => !d.deleted_at && !d.deletedAt)
        .map((d) => ({
          deckId: d.id,
          name: d.name,
          createdAt: d.created_at ?? d.createdAt,
          source: d.source?.type || 'vazio'
        }))

      return { items, created }
    },

    async getMistakes(db, user) {
      const [{ data: deckRows, error: deckErr }, { data: cardRows, error: cardErr }] =
        await Promise.all([
          db.from('decks').select('*').eq('owner_id', user.id).is('deleted_at', null),
          db.from('cards').select('*').eq('owner_id', user.id).is('deleted_at', null)
        ])
      if (deckErr) throw deckErr
      if (cardErr) throw cardErr

      const deckById = new Map((deckRows || []).map((d) => [d.id, d]))
      const items = (cardRows || [])
        .map(mapCardRow)
        .filter((c) => deckById.has(c.deckId) && (c.sched?.lapses || 0) > 0)
        .sort((a, b) => (b.sched.lapses || 0) - (a.sched.lapses || 0))
        .slice(0, 8)
        .map((c) => ({
          cardId: c.id,
          front: c.front,
          lapses: c.sched.lapses,
          deckId: c.deckId,
          deckName: deckById.get(c.deckId)?.name
        }))

      const worstDeck = items[0]?.deckId ? deckById.get(items[0].deckId) : null
      return {
        items,
        reinforcement: worstDeck
          ? {
              deckId: worstDeck.id,
              deckName: worstDeck.name,
              suggestion: `Um deck curto de reforço em "${worstDeck.name}" com os ${items.filter((i) => i.deckId === worstDeck.id).length} cards que você mais erra.`
            }
          : null
      }
    },

    async listObjectives(db, user) {
      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      const { data: rows, error } = await db
        .from('objectives')
        .select('*')
        .eq('user_id', user.id)
        .order('target_date', { ascending: true })
      if (error) throw error

      const objectives = (rows || [])
        .map(mapObjectiveRow)
        .map((o) => ({
          ...o,
          daysLeft: Math.round((new Date(o.date) - new Date(today)) / 86400000),
          past: o.date < today
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return { objectives }
    },

    async createObjective(db, user, { name, date, subjects }) {
      let resolvedSubjects = Array.isArray(subjects) && subjects.length ? subjects : null
      if (!resolvedSubjects) {
        const { data: deckRows, error: deckErr } = await db
          .from('decks')
          .select('*')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
        if (deckErr) throw deckErr
        const mappedDecks = (deckRows || []).map((r) => mapDeckRow(r, [], CATEGORY_MAP))
        resolvedSubjects = inferSubjectsFromDecks(mappedDecks, name)
      }

      const { data: inserted, error: insertErr } = await db
        .from('objectives')
        .insert({
          user_id: user.id,
          name: name.trim(),
          target_date: date,
          subjects: resolvedSubjects
        })
        .select('*')
        .single()
      if (insertErr) throw insertErr

      const { data: allRows, error: listErr } = await db
        .from('objectives')
        .select('*')
        .eq('user_id', user.id)
      if (listErr) throw listErr

      const objective = mapObjectiveRow(inserted)
      const sameDate = (allRows || []).map(mapObjectiveRow).filter((o) => o.date === date)
      return {
        objective,
        tie: sameDate.length > 1 ? sameDate.map((o) => ({ id: o.id, name: o.name })) : null
      }
    },

    async updateObjective(db, user, objectiveId, { name, date, subjects, priority }) {
      const { data: existing, error: findErr } = await db
        .from('objectives')
        .select('*')
        .eq('id', objectiveId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (findErr) throw findErr
      if (!existing) return null

      const patch = {}
      if (name) patch.name = name
      if (date) patch.target_date = date
      if (Array.isArray(subjects)) patch.subjects = subjects
      if (typeof priority === 'boolean') patch.priority = priority

      const { data: updated, error: updateErr } = await db
        .from('objectives')
        .update(patch)
        .eq('id', objectiveId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updateErr) throw updateErr

      return mapObjectiveRow(updated || { ...existing, ...patch })
    },

    async deleteObjective(db, user, objectiveId) {
      const { error } = await db
        .from('objectives')
        .delete()
        .eq('id', objectiveId)
        .eq('user_id', user.id)
      if (error) throw error
      return { ok: true }
    },

    async recordObjectiveOutcome(db, user, objectiveId, { outcome }, ledgerRepo = null) {
      const { data: existing, error: findErr } = await db
        .from('objectives')
        .select('*')
        .eq('id', objectiveId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (findErr) throw findErr
      if (!existing) return null

      const currentObj = mapObjectiveRow(existing)
      let reward = null
      let rewarded = currentObj.outcomeRewarded

      if (!rewarded && !user.deactivatedAt && user.verified?.email && ledgerRepo) {
        rewarded = true
        reward = await ledgerRepo.credit(
          user.id,
          5,
          'objective_outcome',
          { objectiveId: currentObj.id, name: currentObj.name },
          `objective_outcome:${currentObj.id}`
        )
      }

      const patch = {
        outcome,
        outcome_at: nowIso(),
        outcome_rewarded: rewarded
      }
      const { data: updated, error: updateErr } = await db
        .from('objectives')
        .update(patch)
        .eq('id', objectiveId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updateErr) throw updateErr

      const objective = mapObjectiveRow(updated || { ...existing, ...patch })
      const badge =
        outcome === 'aprovado'
          ? {
              label: `Aprovado ${objective.name} ${String(objective.date).slice(0, 4)}`,
              status: 'pendente_confirmacao',
              note: 'Envie o comprovante para o moderador confirmar. O documento é apagado em 24 h após a validação.'
            }
          : null
      const balance = ledgerRepo
        ? await ledgerRepo.getBalance(db, user.id)
        : Number(user.balance ?? 0)

      return { objective, reward, badge, balance }
    }
  }
}
