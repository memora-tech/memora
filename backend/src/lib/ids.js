import { randomUUID, createHash } from 'node:crypto'

export const id = (prefix = '') => (prefix ? `${prefix}_` : '') + randomUUID().slice(0, 8)

export const nowIso = () => new Date().toISOString()

export const daysFromNow = (days, hour = 12) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString()

export const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString()

export const dayKey = (iso = nowIso(), timeZone = 'America/Sao_Paulo') =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex')

export const couponCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `MEM-${block()}-${block()}`
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
