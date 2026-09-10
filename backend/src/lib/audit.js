import { nowIso, sha256 } from './ids.js'

export function appendAudit(state, { actor, actorRole, action, target, details = {}, ts = nowIso() }) {
  const prev = state.auditLog[state.auditLog.length - 1]
  const prevHash = prev ? prev.hash : 'GENESIS'
  const seq = state.auditLog.length + 1
  const payload = JSON.stringify({ seq, ts, actor, actorRole, action, target, details, prevHash })
  const entry = { seq, ts, actor, actorRole, action, target, details, prevHash, hash: sha256(payload) }
  state.auditLog.push(entry)
  return entry
}

export function verifyChain(log) {
  let prevHash = 'GENESIS'
  for (const entry of log) {
    const { hash, ...rest } = entry
    const expected = sha256(JSON.stringify({ ...rest, prevHash }))
    if (expected !== hash || entry.prevHash !== prevHash) return { ok: false, brokenAt: entry.seq }
    prevHash = hash
  }
  return { ok: true, length: log.length }
}

export function recordAccess(state, { operator, operatorRole, subjectUserId, purpose, fields }) {
  const entry = { ts: nowIso(), operator, operatorRole, subjectUserId, purpose, fields }
  state.accessLog.push(entry)
  appendAudit(state, {
    actor: operator,
    actorRole: operatorRole,
    action: 'personal_data_read',
    target: subjectUserId,
    details: { purpose, fields }
  })
  return entry
}
