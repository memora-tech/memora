import { id, nowIso } from './ids.js'

export function balanceOf(state, userId) {
  const entries = state.ledger.filter((e) => e.userId === userId)
  if (!entries.length) return 0
  return entries[entries.length - 1].balanceAfter
}

export function appendEntry(state, { userId, amount, type, meta = {}, ts = nowIso() }) {
  const balanceBefore = balanceOf(state, userId)
  const balanceAfter = balanceBefore + amount
  if (balanceAfter < 0) {
    const error = new Error('insufficient_balance')
    error.code = 'insufficient_balance'
    throw error
  }
  const entry = { id: id('led'), ts, userId, amount, type, meta, balanceAfter }
  state.ledger.push(entry)
  return entry
}

export function credit(state, userId, amount, type, meta) {
  return appendEntry(state, { userId, amount: Math.abs(amount), type, meta })
}

export function debit(state, userId, amount, type, meta) {
  return appendEntry(state, { userId, amount: -Math.abs(amount), type, meta })
}

export function ledgerOf(state, userId) {
  return state.ledger.filter((e) => e.userId === userId).slice().reverse()
}
