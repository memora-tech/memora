import { generateNoaChatReply, isGeminiConfigured } from '../lib/gemini.js'
import { dayKey, daysFromNow, id, nowIso } from '../lib/ids.js'
import { isDeterministicFallbackAllowed } from './generation.repo.js'
import {
  mapCardRow,
  mapNoaChatMessageRow,
  mapNoaDecisionRow,
  mapNoaSuggestionRow,
  mapNotifications
} from './mappers.js'
import { createServiceClient } from './supabase.js'

export const NOA_CATALOG_VERSION = 'v1.2'

export const NOA_CATALOG = [
  {
    key: 'mark_difficult',
    name: 'Marcar deck como difícil',
    trigger: '3 erros seguidos em cards do mesmo deck',
    threshold: 3,
    effect: 'Marca o deck como difícil; as revisões dele ficam mais frequentes.',
    tokenCost: 120,
    autonomous: false,
    reversible: true,
    explanation:
      'Você errou três vezes seguidas em cards deste deck na última sessão. Marcar como difícil faz o algoritmo trazer esses cards mais cedo. Você pode desmarcar a qualquer momento no menu do deck.'
  },
  {
    key: 'reorder_queue',
    name: 'Reordenar fila do dia',
    trigger: 'Deck com mais erros na semana não está no início da fila',
    threshold: 1,
    effect: 'Reordena a fila de hoje. Reversível em um toque.',
    tokenCost: 80,
    autonomous: true,
    reversible: true,
    explanation:
      'Coloquei primeiro o deck em que você mais erra esta semana, porque a memória rende mais no início da sessão.'
  },
  {
    key: 'suggest_reinforcement',
    name: 'Propor deck de reforço',
    trigger: 'Mesmo tópico errado em 3 sessões diferentes',
    threshold: 3,
    effect: 'Gera uma sugestão de deck de reforço; nada é criado sem confirmação.',
    tokenCost: 400,
    autonomous: false,
    reversible: true,
    explanation:
      'Você errou o mesmo tópico em três sessões. Um deck curto de reforço costuma resolver em uma semana.'
  },
  {
    key: 'adjust_goal',
    name: 'Ajustar meta sugerida',
    trigger: 'Meta batida em menos de 3 dos últimos 7 dias',
    threshold: 3,
    effect: 'Ajusta a meta sugerida; a meta configurada só muda se você aceitar.',
    tokenCost: 60,
    autonomous: true,
    reversible: true,
    explanation:
      'Metas que raramente são batidas desmotivam. Sugeri um valor que você conseguiu manter nas últimas semanas.'
  },
  {
    key: 'reminder_time',
    name: 'Escolher horário do lembrete',
    trigger: 'Horário de uso real difere do lembrete em mais de 2 h',
    threshold: 2,
    effect: 'Move o lembrete para o horário em que você mais estuda. Reversível.',
    tokenCost: 40,
    autonomous: true,
    reversible: true,
    explanation:
      'Você costuma estudar em outro horário. Movi o lembrete para ele; pode voltar em Configurações.'
  },
  {
    key: 'reduce_load',
    name: 'Reduzir carga por cansaço',
    trigger: 'Dois de três sinais de cansaço ativos',
    threshold: 2,
    effect: 'Reduz a carga da sessão atual. Você pode manter a carga normal com um toque.',
    tokenCost: 0,
    autonomous: true,
    reversible: true,
    explanation:
      'Dois sinais de cansaço apareceram: tempo de resposta acima do dobro da sua média e taxa de erro 1,5× maior. Reduzi a sessão para proteger a retenção.'
  }
]

export const NOA_SIGNALS = [
  'frequência e horário de acesso',
  'acertos e erros',
  'decks usados ou abandonados',
  'streak e Neurônios'
]

export const NOA_NEVER_ALONE = [
  'excluir ou alterar dados sem confirmação',
  'notificar fora da janela de silêncio',
  'penalizar reputação, banir ou suspender cupons sem revisão humana',
  'expandir sinais analisados sem aviso'
]

export function createNoaRepo({ serviceClient = null } = {}) {
  const getService = () => serviceClient || createServiceClient()

  return {
    async ensureDailyBudget(db, user) {
      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      const chatLimit = Number(process.env.NOA_DAILY_CHAT_LIMIT || 20)

      const [{ data: row, error }, { data: sugRows, error: sugErr }] = await Promise.all([
        db
          .from('noa_daily_budget')
          .select('*')
          .eq('user_id', user.id)
          .eq('day_key', today)
          .maybeSingle(),
        db.from('noa_suggestions').select('*').eq('user_id', user.id)
      ])
      if (error) throw error
      if (sugErr) throw sugErr

      const suggestionsToday = (sugRows || []).filter(
        (g) => dayKey(g.created_at ?? g.createdAt, tz) === today
      ).length

      if (!row) {
        const admin = getService()
        await admin.from('noa_daily_budget').insert({
          user_id: user.id,
          day_key: today,
          suggestions_used: suggestionsToday,
          suggestions_limit: 5,
          autonomous_used: 0,
          autonomous_limit: 1,
          chat_used: 0,
          chat_limit: chatLimit
        })
        return {
          dayKey: today,
          suggestionsUsed: suggestionsToday,
          suggestionsLimit: 5,
          autonomousUsed: 0,
          autonomousLimit: 1,
          chatUsed: 0,
          chatLimit
        }
      }

      return {
        dayKey: today,
        suggestionsUsed: Math.max(Number(row.suggestions_used ?? 0), suggestionsToday),
        suggestionsLimit: Number(row.suggestions_limit ?? 5),
        autonomousUsed: Number(row.autonomous_used ?? 0),
        autonomousLimit: Number(row.autonomous_limit ?? 1),
        chatUsed: Number(row.chat_used ?? 0),
        chatLimit: Number(process.env.NOA_DAILY_CHAT_LIMIT || row.chat_limit || chatLimit)
      }
    },

    async setChatUsed(userId, today, nextChatUsed, chatLimit) {
      const admin = getService()
      const safeUsed = Math.max(0, Number(nextChatUsed))
      const { data: existing, error: selErr } = await admin
        .from('noa_daily_budget')
        .select('*')
        .eq('user_id', userId)
        .eq('day_key', today)
        .maybeSingle()
      if (selErr) throw selErr

      if (existing) {
        const { error: updErr } = await admin
          .from('noa_daily_budget')
          .update({ chat_used: safeUsed })
          .eq('user_id', userId)
          .eq('day_key', today)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await admin.from('noa_daily_budget').insert({
          user_id: userId,
          day_key: today,
          suggestions_used: 0,
          suggestions_limit: 5,
          autonomous_used: 0,
          autonomous_limit: 1,
          chat_used: safeUsed,
          chat_limit: Number(chatLimit || process.env.NOA_DAILY_CHAT_LIMIT || 20)
        })
        if (insErr) throw insErr
      }
      return safeUsed
    },

    async listChatMessages(db, user, { limit = 50 } = {}) {
      const budget = await this.ensureDailyBudget(db, user)
      const { data: rows, error } = await db
        .from('noa_chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) throw error

      return {
        messages: (rows || []).map(mapNoaChatMessageRow),
        budget: {
          used: budget.chatUsed,
          limit: budget.chatLimit
        }
      }
    },

    async sendChatMessage(
      db,
      user,
      { message, deckId = null },
      { aiChatGenerator = null } = {}
    ) {
      const budget = await this.ensureDailyBudget(db, user)
      if (budget.chatUsed >= budget.chatLimit) {
        return {
          limitExceeded: {
            used: budget.chatUsed,
            limit: budget.chatLimit
          }
        }
      }

      const cleanMessage = String(message || '').trim()
      const { data: historyRows, error: histErr } = await db
        .from('noa_chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(20)
      if (histErr) throw histErr

      let deckName = null
      if (deckId) {
        const { data: deckRow } = await db
          .from('decks')
          .select('name')
          .eq('id', deckId)
          .eq('owner_id', user.id)
          .maybeSingle()
        if (deckRow?.name) deckName = deckRow.name
      }

      const nextUsed = await this.setChatUsed(
        user.id,
        budget.dayKey,
        budget.chatUsed + 1,
        budget.chatLimit
      )

      const history = (historyRows || []).map(mapNoaChatMessageRow)

      let replyText = ''
      let usedModel = 'gemini-2.5-flash'
      let usedTokens = 0

      try {
        if (typeof aiChatGenerator === 'function') {
          const generated = await aiChatGenerator(
            { message: cleanMessage, history, deckId, deckName },
            user
          )
          replyText = String(generated?.reply ?? generated?.text ?? generated ?? '').trim()
          usedModel = generated?.model || 'gemini-2.5-flash'
          usedTokens = Number(generated?.tokens ?? 0)
        } else if (isGeminiConfigured()) {
          const generated = await generateNoaChatReply({
            message: cleanMessage,
            history,
            context: { userName: user.name, deckId, deckName }
          })
          replyText = generated.reply
          usedModel = generated.model
          usedTokens = generated.tokens
        } else if (isDeterministicFallbackAllowed()) {
          const firstName = String(user.name || 'estudante').split(' ')[0]
          replyText = `Olá, ${firstName}! Sobre "${cleanMessage.slice(
            0,
            60
          )}": recomendo revisar os conceitos-chave em blocos curtos e focar nos cards que você mais errou hoje.`
          usedModel = 'deterministic-test-fallback'
          usedTokens = 42
        } else {
          const err = new Error('Provedor de IA não configurado para o chat da Nôa.')
          err.code = 'ai_unavailable'
          err.status = 503
          throw err
        }
      } catch (err) {
        await this.setChatUsed(
          user.id,
          budget.dayKey,
          Math.max(0, nextUsed - 1),
          budget.chatLimit
        )
        throw err
      }

      const userPayload = {
        id: id('msg'),
        user_id: user.id,
        role: 'user',
        content: cleanMessage,
        metadata: deckId ? { deckId } : {},
        created_at: nowIso()
      }
      const { data: insUser, error: uErr } = await db
        .from('noa_chat_messages')
        .insert(userPayload)
        .select('*')
        .single()
      if (uErr) throw uErr

      const assistantPayload = {
        id: id('msg'),
        user_id: user.id,
        role: 'assistant',
        content: replyText,
        metadata: {
          ...(deckId ? { deckId } : {}),
          model: usedModel,
          tokens: usedTokens
        },
        created_at: nowIso()
      }
      const { data: insAssistant, error: aErr } = await db
        .from('noa_chat_messages')
        .insert(assistantPayload)
        .select('*')
        .single()
      if (aErr) throw aErr

      const userMessage = mapNoaChatMessageRow(insUser || userPayload)
      const assistantMessage = mapNoaChatMessageRow(insAssistant || assistantPayload)

      return {
        userMessage,
        assistantMessage,
        message: assistantMessage,
        budget: {
          used: nextUsed,
          limit: budget.chatLimit
        }
      }
    },

    async getCatalog(db, user) {
      const budget = await this.ensureDailyBudget(db, user)
      return {
        version: NOA_CATALOG_VERSION,
        actions: NOA_CATALOG,
        budget,
        signals: NOA_SIGNALS,
        neverAlone: NOA_NEVER_ALONE
      }
    },

    async getOverview(db, user, studyRepo, ledgerRepo = null) {
      const [
        budget,
        today,
        { data: sugRows, error: sugErr },
        { data: decRows, error: decErr },
        { data: deckRows, error: deckErr },
        { data: cardRows, error: cardErr },
        { data: revRows, error: revErr }
      ] = await Promise.all([
        this.ensureDailyBudget(db, user),
        studyRepo.todaySession(db, user, ledgerRepo),
        db
          .from('noa_suggestions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        db
          .from('noa_decisions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        db.from('decks').select('*').eq('owner_id', user.id).is('deleted_at', null),
        db.from('cards').select('*').eq('owner_id', user.id).is('deleted_at', null),
        db
          .from('reviews')
          .select('*')
          .eq('user_id', user.id)
          .order('reviewed_at', { ascending: false })
          .limit(30)
      ])
      if (sugErr) throw sugErr
      if (decErr) throw decErr
      if (deckErr) throw deckErr
      if (cardErr) throw cardErr
      if (revErr) throw revErr

      const suggestions = (sugRows || [])
        .map(mapNoaSuggestionRow)
        .filter((s) => s.status === 'pendente')
      const decisions = (decRows || []).map(mapNoaDecisionRow).slice(0, 10)

      const cardsByDeck = {}
      for (const c of (cardRows || []).map(mapCardRow)) {
        if (!cardsByDeck[c.deckId]) cardsByDeck[c.deckId] = []
        cardsByDeck[c.deckId].push(c)
      }

      const weakest =
        (deckRows || [])
          .map((d) => {
            const cards = cardsByDeck[d.id] || []
            return {
              id: d.id,
              name: d.name,
              lapses: cards.reduce((n, c) => n + (c.sched?.lapses || 0), 0),
              weakCards: cards.filter((c) => (c.sched?.lapses || 0) > 0).length
            }
          })
          .filter((d) => d.lapses > 0)
          .sort((a, b) => b.lapses - a.lapses)[0] || null

      const recent = (revRows || []).slice(0, 30)
      const accuracy = recent.length
        ? Math.round(
            (recent.filter((r) => r.rating === 'good' || r.rating === 'easy').length /
              recent.length) *
              100
          )
        : null

      const insights = {
        today: {
          cardsDue: today.cardsDue,
          minutes: today.estimatedMinutes,
          decks: today.plan.length,
          status: today.status
        },
        weakest,
        objective: today.nearestObjective
          ? {
              id: today.nearestObjective.id,
              name: today.nearestObjective.name,
              daysLeft: today.nearestObjective.daysLeft
            }
          : null,
        accuracy: accuracy === null ? null : { pct: accuracy, sample: recent.length },
        goal: {
          done: today.doneToday,
          goal: today.goal,
          suggested: today.goalSuggested || null
        },
        streak: today.streak
      }

      return {
        insights,
        catalog: NOA_CATALOG,
        catalogVersion: NOA_CATALOG_VERSION,
        budget,
        suggestions,
        decisions,
        mcp: { connections: 0, aiSaved: 0 },
        signals: NOA_SIGNALS,
        neverAlone: NOA_NEVER_ALONE
      }
    },

    async respondSuggestion(db, user, suggestionId, { accepted, feedback }, auditRepo = null) {
      const { data: sugRow, error: findErr } = await db
        .from('noa_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (findErr) throw findErr
      if (!sugRow) return null

      const currentSug = mapNoaSuggestionRow(sugRow)
      const status = accepted ? 'aceita' : 'dispensada'
      const respondedAt = nowIso()

      const { data: updatedSug, error: updErr } = await db
        .from('noa_suggestions')
        .update({
          status,
          responded_at: respondedAt,
          feedback: feedback || null
        })
        .eq('id', suggestionId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      let effect = null
      let previousState = null

      if (accepted) {
        if (currentSug.actionKey === 'mark_difficult' && currentSug.deckId) {
          const { data: deckRow } = await db
            .from('decks')
            .select('*')
            .eq('id', currentSug.deckId)
            .eq('owner_id', user.id)
            .maybeSingle()
          if (deckRow) {
            previousState = {
              deckId: deckRow.id,
              difficult: Boolean(deckRow.difficult)
            }
            await db
              .from('decks')
              .update({ difficult: true })
              .eq('id', deckRow.id)
              .eq('owner_id', user.id)
            effect = {
              type: 'deck_marked_difficult',
              deckId: deckRow.id,
              deckName: deckRow.name,
              undo: {
                method: 'PATCH',
                path: `/v1/decks/${deckRow.id}`,
                body: { difficult: false }
              }
            }
          }
        } else if (currentSug.actionKey === 'adjust_goal' && currentSug.goal) {
          const { data: studyRow } = await db
            .from('study_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()
          const previousGoal = Number(studyRow?.goal ?? 20)
          previousState = { goal: previousGoal }
          await db
            .from('study_settings')
            .update({ goal: Number(currentSug.goal) })
            .eq('user_id', user.id)
          effect = {
            type: 'goal_adjusted',
            from: previousGoal,
            to: Number(currentSug.goal)
          }
        } else if (currentSug.actionKey === 'suggest_reinforcement') {
          effect = {
            type: 'reinforcement_proposed',
            deckId: currentSug.deckId
          }
        }
      }

      const decisionRow = {
        id: id('dec'),
        user_id: user.id,
        action_key: currentSug.actionKey,
        text: `${accepted ? 'Você aceitou' : 'Você dispensou'}: ${currentSug.title}`,
        reversible: true,
        reverted: false,
        accepted: Boolean(accepted),
        previous_state: previousState,
        contested: null,
        created_at: nowIso()
      }
      await db.from('noa_decisions').insert(decisionRow)

      if (auditRepo) {
        await auditRepo.append({
          actor: 'noa',
          actorRole: 'agent',
          action: `suggestion_${accepted ? 'accepted' : 'dismissed'}`,
          target: currentSug.id,
          details: { actionKey: currentSug.actionKey }
        })
      }

      return {
        suggestion: mapNoaSuggestionRow(
          updatedSug || {
            ...sugRow,
            status,
            responded_at: respondedAt,
            feedback: feedback || null
          }
        ),
        effect
      }
    },

    async revertDecision(db, user, decisionId, auditRepo = null) {
      const { data: decRow, error: findErr } = await db
        .from('noa_decisions')
        .select('*')
        .eq('id', decisionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (findErr) throw findErr
      if (!decRow) return { notFound: true }
      if (decRow.reversible === false) return { notReversible: true }

      const revertedAt = nowIso()
      const { data: updated, error: updErr } = await db
        .from('noa_decisions')
        .update({ reverted: true, reverted_at: revertedAt })
        .eq('id', decisionId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      const actionKey = decRow.action_key ?? decRow.actionKey
      const prev = decRow.previous_state ?? decRow.previousState ?? {}

      if (actionKey === 'reorder_queue') {
        const nextOrder = Array.isArray(prev.planOrder) ? prev.planOrder : []
        await db
          .from('study_settings')
          .update({ plan_order: nextOrder })
          .eq('user_id', user.id)
      } else if (actionKey === 'reminder_time') {
        const nextTime = prev.reminderTime || '21:00'
        const nextNotifications = {
          ...mapNotifications(user.notifications),
          reminderTime: nextTime
        }
        await db
          .from('profiles')
          .update({ notifications: nextNotifications })
          .eq('id', user.id)
      } else if (actionKey === 'adjust_goal' && prev.goal) {
        await db
          .from('study_settings')
          .update({ goal: Number(prev.goal) })
          .eq('user_id', user.id)
      } else if (actionKey === 'mark_difficult' && prev.deckId) {
        await db
          .from('decks')
          .update({ difficult: Boolean(prev.difficult) })
          .eq('id', prev.deckId)
          .eq('owner_id', user.id)
      }

      if (auditRepo) {
        await auditRepo.append({
          actor: user.id,
          actorRole: 'student',
          action: 'noa_decision_reverted',
          target: decRow.id,
          details: { actionKey }
        })
      }

      return {
        decision: mapNoaDecisionRow(
          updated || { ...decRow, reverted: true, reverted_at: revertedAt }
        )
      }
    },

    async listPrivacyDecisions(db, user) {
      const { data: rows, error } = await db
        .from('noa_decisions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error

      const decisions = (rows || [])
        .map(mapNoaDecisionRow)
        .map((d) => ({
          ...d,
          action: NOA_CATALOG.find((c) => c.key === d.actionKey) || null
        }))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))

      return {
        decisions,
        rights: {
          law: 'LGPD art. 20',
          responseDays: 15,
          criteriaExplained: true
        },
        catalogVersion: NOA_CATALOG_VERSION
      }
    },

    async contestDecision(db, user, decisionId, { text }, auditRepo = null) {
      const { data: decRow, error: findErr } = await db
        .from('noa_decisions')
        .select('*')
        .eq('id', decisionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (findErr) throw findErr
      if (!decRow) return null

      const contested = {
        at: nowIso(),
        text: text.trim(),
        dueBy: daysFromNow(15),
        status: 'em_analise',
        reviewer: 'humano (compliance)'
      }

      const { data: updated, error: updErr } = await db
        .from('noa_decisions')
        .update({ contested })
        .eq('id', decisionId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      if (auditRepo) {
        await auditRepo.append({
          actor: user.id,
          actorRole: 'student',
          action: 'automated_decision_contested',
          target: decRow.id,
          details: {}
        })
      }

      return mapNoaDecisionRow(updated || { ...decRow, contested })
    },

    async requestDataExport(db, user, auditRepo = null) {
      const { data: profile, error: profErr } = await db
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle()
      if (profErr) throw profErr

      const request = {
        id: id('exp'),
        userId: user.id,
        requestedAt: nowIso(),
        dueBy: daysFromNow(15),
        linkValidDays: 7,
        format: 'JSON + CSV, mídia em ZIP',
        contents: [
          'decks',
          'cards',
          'histórico de estudo',
          'Neurônios',
          'comentários',
          'pagamentos'
        ],
        status: 'em_preparo'
      }

      const currentSettings = profile?.settings || user.settings || {}
      const existingExports = Array.isArray(currentSettings.privacyExports)
        ? currentSettings.privacyExports
        : []
      const nextSettings = {
        ...currentSettings,
        privacyExports: [request, ...existingExports]
      }

      const { error: updErr } = await db
        .from('profiles')
        .update({ settings: nextSettings })
        .eq('id', user.id)
      if (updErr) throw updErr

      if (auditRepo) {
        await auditRepo.append({
          actor: user.id,
          actorRole: 'student',
          action: 'data_export_requested',
          target: user.id,
          details: { requestId: request.id }
        })
      }

      return request
    },

    async listDataExports(db, user) {
      const { data: profile, error } = await db
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      const requests = Array.isArray(profile?.settings?.privacyExports)
        ? profile.settings.privacyExports
        : []
      return { requests }
    },

    async requestAccountDeletion(db, user, auditRepo = null) {
      const admin = getService()
      const { data: profile, error: profErr } = await admin
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle()
      if (profErr) throw profErr

      const requestedAt = nowIso()
      const deletion = {
        id: id('del'),
        userId: user.id,
        requestedAt,
        purgeAt: daysFromNow(30),
        reactivable: true,
        status: 'desativada',
        effects: [
          'Comentários e votos ficam sem autor',
          'Decks publicados continuam disponíveis sem autor vinculado',
          'Assinatura cancelada sem nova cobrança',
          'Neurônios e cupons não usados expiram',
          'Você sai das pastas compartilhadas',
          'Dados pessoais excluídos após 30 dias; dados fiscais ficam 5 anos em base segregada'
        ]
      }

      const currentSettings = profile?.settings || user.settings || {}
      const existingDeletions = Array.isArray(currentSettings.privacyDeletions)
        ? currentSettings.privacyDeletions
        : []
      const nextSettings = {
        ...currentSettings,
        privacyDeletions: [deletion, ...existingDeletions]
      }

      const { error: updErr } = await admin
        .from('profiles')
        .update({
          deactivated_at: requestedAt,
          settings: nextSettings
        })
        .eq('id', user.id)
      if (updErr) throw updErr

      if (auditRepo) {
        await auditRepo.append({
          actor: user.id,
          actorRole: 'student',
          action: 'account_deletion_requested',
          target: user.id,
          details: { purgeAt: deletion.purgeAt }
        })
      }

      return deletion
    },

    async reactivateAccount(db, user) {
      const admin = getService()
      const { data: profile, error: profErr } = await admin
        .from('profiles')
        .select('deactivated_at, settings')
        .eq('id', user.id)
        .maybeSingle()
      if (profErr) throw profErr

      const deactivatedAt = profile?.deactivated_at ?? user.deactivatedAt
      const currentSettings = profile?.settings || user.settings || {}
      const deletions = Array.isArray(currentSettings.privacyDeletions)
        ? currentSettings.privacyDeletions
        : []
      const pending = deletions.find((d) => d.status === 'desativada')

      if (!deactivatedAt && !pending) {
        return { notDeactivated: true }
      }

      const nextDeletions = deletions.map((d) =>
        d.status === 'desativada'
          ? { ...d, status: 'reativada', reactivatedAt: nowIso() }
          : d
      )
      const nextSettings = {
        ...currentSettings,
        privacyDeletions: nextDeletions
      }

      const { error: updErr } = await admin
        .from('profiles')
        .update({
          deactivated_at: null,
          settings: nextSettings
        })
        .eq('id', user.id)
      if (updErr) throw updErr

      return { ok: true }
    },

    getPrivacyPolicy() {
      return {
        policy: {
          version: 'v2.1',
          publishedAt: daysFromNow(-14),
          url: '/politica-de-conteudo',
          changes: [
            'Regra nova sobre material protegido por direitos autorais',
            'Prazo de contestação explícito: 30 dias'
          ]
        },
        dpo: {
          name: 'Sócio-fundador (nomeação formal)',
          email: 'dpo@memora.app'
        },
        summary: [
          'Conteúdo próprio ou com permissão de uso',
          'Sem dados pessoais de terceiros',
          'Sem material impróprio ou discriminatório',
          'Rejeições vêm com motivo e trecho apontado; contestação em 30 dias'
        ]
      }
    }
  }
}
