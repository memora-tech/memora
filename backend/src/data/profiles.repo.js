import { dayKey, daysFromNow, nowIso } from '../lib/ids.js'
import { weekKey } from '../seed/index.js'
import {
  DEFAULT_SUBSCRIPTION_OFFER,
  mapConsentsRow,
  mapNotifications,
  mapObjectiveRow,
  mapProfileToUser,
  mapStudySettingsRow
} from './mappers.js'
import { createServiceClient } from './supabase.js'

export { mapProfileToUser }

export function createProfilesRepo({ serviceClient = null } = {}) {
  const getService = () => serviceClient || createServiceClient()

  return {
    async getById(db, userId) {
      const [{ data: profile, error: profileErr }, { data: study }, { data: ledgerRows }] =
        await Promise.all([
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
      const balance =
        Array.isArray(ledgerRows) && ledgerRows[0] ? Number(ledgerRows[0].balance_after) : 0
      return mapProfileToUser(profile, study, balance)
    },

    async ensureDay(db, user) {
      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      const yesterday = dayKey(daysFromNow(-1), tz)
      const currentWeek = weekKey()

      const { data: studyRow, error: studyErr } = await db
        .from('study_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (studyErr) throw studyErr

      if (!studyRow) {
        return {
          today,
          study: {
            goal: 20,
            goalSuggested: 20,
            doneToday: 0,
            dayKey: today,
            streak: user.streak ?? 0,
            studyDays: user.studyDays ?? 0,
            fatigueDetection: true
          }
        }
      }

      const patch = {}
      if (studyRow.day_key !== today) {
        patch.day_key = today
        patch.done_today = 0
        if (
          studyRow.last_study_day &&
          studyRow.last_study_day !== yesterday &&
          studyRow.last_study_day !== today &&
          studyRow.skipped_day !== yesterday
        ) {
          patch.streak = 0
        }
      }
      if (studyRow.reschedules_week_key !== currentWeek) {
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
        const mapped = mapStudySettingsRow(updated || { ...studyRow, ...patch })
        return { today, study: mapped }
      }

      return { today, study: mapStudySettingsRow(studyRow) }
    },

    async getConsents(db, userId) {
      const { data, error } = await db
        .from('user_consents')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return mapConsentsRow(data)
    },

    async updateConsents(db, userId, body = {}) {
      const current = await this.getConsents(db, userId)
      const nextSchoolShare =
        typeof body.schoolShare === 'boolean' ? body.schoolShare : current.schoolShare
      const nextWhatsapp = body.whatsapp
        ? { ...current.whatsapp, ...body.whatsapp }
        : current.whatsapp

      const { data: updated, error } = await db
        .from('user_consents')
        .update({
          school_share: nextSchoolShare,
          whatsapp: nextWhatsapp
        })
        .eq('user_id', userId)
        .select('*')
        .maybeSingle()
      if (error) throw error

      return mapConsentsRow(
        updated || {
          school_share: nextSchoolShare,
          whatsapp: nextWhatsapp,
          content_policy_accepted_version: current.contentPolicyAcceptedVersion,
          content_policy_accepted_at: current.contentPolicyAcceptedAt
        }
      )
    },

    async updateSettings(db, user, body = {}) {
      const currentNotifications = mapNotifications(user.notifications)
      const nextNotifications = { ...currentNotifications }
      if (body.intensity) nextNotifications.intensity = body.intensity
      if (body.reminderTime) nextNotifications.reminderTime = body.reminderTime
      if (typeof body.push === 'boolean') nextNotifications.push = body.push

      const nextSettings = body.accessibility
        ? {
            ...(user.settings || {}),
            accessibility: {
              ...(user.settings?.accessibility || {}),
              ...body.accessibility
            }
          }
        : user.settings || {}

      const profilePatch = {
        notifications: nextNotifications,
        settings: nextSettings
      }
      if (body.timezone) profilePatch.timezone = String(body.timezone)
      if (body.locale) profilePatch.locale = String(body.locale)
      if (body.name && String(body.name).trim().length >= 2) {
        profilePatch.name = String(body.name).trim()
      }

      const studyPatch = {}
      if (typeof body.dailyGoal === 'number') {
        studyPatch.goal = Math.min(200, Math.max(5, Math.round(body.dailyGoal)))
      }
      if (typeof body.fatigueDetection === 'boolean') {
        studyPatch.fatigue_detection = body.fatigueDetection
      }

      const [{ data: updatedProfile, error: profErr }, studyResult] = await Promise.all([
        db.from('profiles').update(profilePatch).eq('id', user.id).select('*').maybeSingle(),
        Object.keys(studyPatch).length > 0
          ? db
              .from('study_settings')
              .update(studyPatch)
              .eq('user_id', user.id)
              .select('*')
              .maybeSingle()
          : db.from('study_settings').select('*').eq('user_id', user.id).maybeSingle()
      ])
      if (profErr) throw profErr
      if (studyResult?.error) throw studyResult.error

      const studyRow = studyResult?.data || null
      const mergedUser = mapProfileToUser(
        updatedProfile || {
          ...user,
          name: profilePatch.name || user.name,
          locale: profilePatch.locale || user.locale,
          timezone: profilePatch.timezone || user.timezone,
          settings: nextSettings,
          notifications: nextNotifications
        },
        studyRow,
        user.balance
      )

      return {
        user: mergedUser,
        notifications: mergedUser.notifications,
        study: {
          goal: Number(studyRow?.goal ?? studyPatch.goal ?? 20),
          fatigueDetection:
            studyRow?.fatigue_detection !== undefined
              ? Boolean(studyRow.fatigue_detection)
              : typeof studyPatch.fatigue_detection === 'boolean'
                ? studyPatch.fatigue_detection
                : true
        }
      }
    },

    async changePassword(db, user, { next }) {
      if (db?.auth?.updateUser) {
        const { error } = await db.auth.updateUser({ password: String(next) })
        if (error) throw error
        return { ok: true }
      }
      if (serviceClient?.auth?.admin?.updateUserById) {
        const { error } = await serviceClient.auth.admin.updateUserById(user.id, {
          password: String(next)
        })
        if (error) throw error
      }
      return { ok: true }
    },

    async getSubscriptionSummary(user) {
      return {
        plan: user?.plan || 'free',
        offer: { ...DEFAULT_SUBSCRIPTION_OFFER },
        payments: [],
        cancelledAt: null
      }
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

      const [{ error: consentErr }, { data: study, error: studyErr }, { error: budgetErr }] =
        await Promise.all([
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

    async completeOnboarding(
      db,
      userId,
      { context, subjects = [], minutesPerDay = 10, objective = null }
    ) {
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
        createdObjective = mapObjectiveRow(objRow)
      }

      return {
        goal,
        objective: createdObjective,
        planOfDay: { minutes: minutesPerDay, cards: goal }
      }
    }
  }
}
