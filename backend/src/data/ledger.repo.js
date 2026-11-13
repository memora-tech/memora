import { mapLedgerRow, mapWalletSummary } from './mappers.js'
import { createServiceClient } from './supabase.js'

export function createLedgerRepo({ serviceClient = null } = {}) {
  const getService = () => serviceClient || createServiceClient()

  return {
    async getBalance(db, userId) {
      const { data, error } = await db
        .from('neuron_ledger')
        .select('balance_after')
        .eq('user_id', userId)
        .order('seq', { ascending: false })
        .limit(1)
      if (error) throw error
      return Array.isArray(data) && data[0] ? Number(data[0].balance_after) : 0
    },

    async listEntries(db, userId) {
      const { data, error } = await db
        .from('neuron_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('seq', { ascending: false })
      if (error) throw error
      return (data || []).map(mapLedgerRow)
    },

    async appendEntry({ userId, amount, type, meta = {}, idempotencyKey = null }) {
      const admin = getService()
      const { data, error } = await admin.rpc('append_neuron_ledger_entry', {
        p_user_id: userId,
        p_amount: Number(amount),
        p_type: String(type),
        p_meta: meta || {},
        p_idempotency_key: idempotencyKey
      })
      if (error) {
        if (error.message?.includes('insufficient_balance') || error.code === 'P0001') {
          const insufficient = new Error('insufficient_balance')
          insufficient.code = 'insufficient_balance'
          insufficient.status = 422
          throw insufficient
        }
        throw error
      }
      const row = Array.isArray(data) ? data[0] : data
      return mapLedgerRow(row)
    },

    async credit(userId, amount, type, meta = {}, idempotencyKey = null) {
      return this.appendEntry({
        userId,
        amount: Math.abs(Number(amount)),
        type,
        meta,
        idempotencyKey
      })
    },

    async debit(userId, amount, type, meta = {}, idempotencyKey = null) {
      return this.appendEntry({
        userId,
        amount: -Math.abs(Number(amount)),
        type,
        meta,
        idempotencyKey
      })
    },

    async creditDailyAccess(db, userId, today) {
      const idempotencyKey = `daily_access:${today}`
      const { data: existing, error: findErr } = await db
        .from('neuron_ledger')
        .select('id')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
      if (findErr) throw findErr
      if (existing) {
        return null
      }
      return this.credit(userId, 1, 'daily_access', { day: today }, idempotencyKey)
    },

    async getWallet(db, user) {
      const ledger = await this.listEntries(db, user.id)
      const balance = ledger.length ? ledger[0].balanceAfter : Number(user?.balance ?? 0)
      return mapWalletSummary({
        user,
        balance,
        ledger,
        studyDays: user?.studyDays ?? 0
      })
    }
  }
}
