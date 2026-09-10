const LOCALE = 'pt-BR'

export const fmtNumber = (n) => new Intl.NumberFormat(LOCALE).format(n ?? 0)

export const fmtBRL = (n) => new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' }).format(n ?? 0)

export const fmtDate = (iso, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) => (iso ? new Intl.DateTimeFormat(LOCALE, opts).format(new Date(iso)) : '')

export const fmtDateShort = (iso) => (iso ? new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short' }).format(new Date(iso)).replace('.', '') : '')

export const fmtTime = (iso) => (iso ? new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '')

export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)} às ${fmtTime(iso)}` : '')

export function fmtRelative(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 1) return 'agora'
  if (Math.abs(minutes) < 60) return minutes > 0 ? `há ${minutes} min` : `em ${-minutes} min`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return hours > 0 ? `há ${hours} h` : `em ${-hours} h`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return days > 0 ? `há ${days} d` : `em ${-days} d`
  return fmtDate(iso)
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`)
  return Math.round((target - today) / 86400000)
}

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

export const plural = (n, one, many) => (n === 1 ? one : many)

export const difficultyLabel = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' }

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
