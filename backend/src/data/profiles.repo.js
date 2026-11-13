import { dayKey, nowIso } from '../lib/ids.js'
import { weekKey } from '../seed/index.js'
import { createServiceClient } from './supabase.js'

export function mapProfileToUser(row, studyRow = null, balance = 0) {
  if (!row) return null
  return {
    id: row.id,
    role: row.role || 'student',
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    birthDate: row.birth_date,
    isMinor: false,
    guardianId: null,
    isStudent: row.is_student !== false,
    origin: row.origin || null,
    plan: row.plan || 'free',
    locale: row.locale || 'pt-BR',
    timezone: row.timezone || 'America/Sao_Paulo',
    verified: { email: true, phone: Boolean(row.phone) },
    canEarn: true,
    ageVerification: { status: 'aprovado', method: 'cadastro_maior_18', provider: 'Supabase Auth' },
    createdAt: row.created_at,
    deactivatedAt: row.deactivated_at || null,
    publicProfile: row.public_profile || {
      level: 1,
      topic: 'Geral',
      points: 0,
      badges: [],
      cardsGenerated: 0,
      bio: ''
    },
    settings: row.settings || {},
    notifications: row.notifications || null,
    guardianPermissions: null,
    streak: studyRow?.streak ?? 0,
    studyDays: studyRow?.study_days ?? 0,
    balance: balance ?? 0,
    onboardingDone: Boolean(row.onboarding_done),
    onboarding: row.onboarding_data || {}
  }
}

export function createProfilesRepo({ serviceClient = null } = {}) {
  const getService = () => serviceClient || createServiceClient()

  return {
    async getById(db, userId) {
      const [{ data: profile, error: profileErr }, { data: study }, { data: ledgerRows }] = await Promise.all([
        db.from('profiles').select('*').eq('id', userId).maybeSingle(),
        db.from('study_settings').select('*').eq('user_id', userId).maybeSingle(),
        db
          .from('neuron_ledger')
          .select('balance_after')
          .eq('user_id', userId)
          .order('seq', { ascending: false })
          .limit(1)
      ])
      if (profileErr) throw profileErr
      if (!profile) return null
      const balance = Array.isArray(ledgerRows) && ledgerRows[0] ? ledgerRows[0].balance_after : 0
      return mapProfileToUser(profile, study, balance)
    },

    async provisionNewStudent({
      id,
      name,
      email,
      phone = null,
      birthDate,
      isStudent = true,
      origin = null,
      timezone = 'America/Sao_Paulo'
    }) {
      const admin = getService()
      const today = dayKey(nowIso(), timezone)
      const currentWeek = weekKey()
      const chatLimit = Number(process.env.NOA_DAILY_CHAT_LIMIT || 20)

      const { data: profile, error: profileErr } = await admin
        .from('profiles')
        .upsert(
          {
            id,
            role: 'student',
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone || null,
            birth_date: birthDate,
            is_student: Boolean(isStudent),
            origin: origin || null,
            plan: 'free',
            timezone,
            onboarding_done: false
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single()
      if (profileErr) throw profileErr

      const [{ error: consentErr }, { data: study, error: studyErr }, { error: budgetErr }] = await Promise.all([
        admin.from('user_consents').upsert({ user_id: id }, { onConflict: 'user_id' }),
        admin
          .from('study_settings')
          .upsert(
            {
              user_id: id,
              goal: 20,
              goal_suggested: 20,
              done_today: 0,
              day_key: today,
              reschedules_week_key: currentWeek
            },
            { onConflict: 'user_id' }
          )
          .select('*')
          .single(),
        admin.from('noa_daily_budget').upsert(
          {
            user_id: id,
            day_key: today,
            chat_limit: chatLimit
          },
          { onConflict: 'user_id,day_key' }
        )
      ])
      if (consentErr) throw consentErr
      if (studyErr) throw studyErr
      if (budgetErr) throw budgetErr

      return mapProfileToUser(profile, study, 0)
    },

    async completeOnboarding(db, userId, { context, subjects = [], minutesPerDay = 10, objective = null }) {
      const goal = Math.max(5, Math.round((minutesPerDay * 60) / 20 / 5) * 5)
      const onboardingData = { context, subjects, minutesPerDay, at: nowIso() }

      const [{ error: profErr }, { error: studyErr }] = await Promise.all([
        db
          .from('profiles')
          .update({ onboarding_done: true, onboarding_data: onboardingData })
          .eq('id', userId),
        db
          .from('study_settings')
          .update({ goal, goal_suggested: goal })
          .eq('user_id', userId)
      ])
      if (profErr) throw profErr
      if (studyErr) throw studyErr

      let createdObjective = null
      if (objective?.name && objective?.date) {
        const { data: objRow, error: objErr } = await db
          .from('objectives')
          .insert({
            user_id: userId,
            name: objective.name,
            target_date: objective.date,
            subjects: Array.isArray(subjects) ? subjects : []
          })
          .select('*')
          .single()
        if (objErr) throw objErr
        createdObjective = {
          id: objRow.id,
          userId: objRow.user_id,
          name: objRow.name,
          date: objRow.target_date,
          subjects: objRow.subjects || [],
          priority: Boolean(objRow.priority),
          outcome: objRow.outcome,
          outcomeAt: objRow.outcome_at,
          outcomeRewarded: Boolean(objRow.outcome_rewarded),
          createdAt: objRow.created_at
        }
      }

      return {
        goal,
        objective: createdObjective,
        planOfDay: { minutes: minutesPerDay, cards: goal }
      }
    }
  }
}

