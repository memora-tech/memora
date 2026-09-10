import { createContext, useContext } from 'react'
import { ptBR } from './pt-BR/index.js'

const DICTIONARIES = { 'pt-BR': ptBR }

export const SUPPORTED_LOCALES = [
  { code: 'pt-BR', label: 'Português (Brasil)', available: true },
  { code: 'en', label: 'English', available: false }
]

function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict)
}

function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`))
}

export function createT(locale = 'pt-BR') {
  const dict = DICTIONARIES[locale] || ptBR
  const t = (key, vars) => {
    const value = lookup(dict, key)
    if (value === undefined) return key
    if (Array.isArray(value)) return value
    if (value !== null && typeof value === 'object') {
      const raw = vars?.count
      const count = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d-]/g, ''))
      const form = Number.isFinite(count) && count === 1 ? value.one : value.other
      return interpolate(form ?? value.other ?? value.one ?? '', vars)
    }
    return interpolate(value, vars)
  }
  t.locale = locale
  t.has = (key) => lookup(dict, key) !== undefined
  return t
}

export const I18nContext = createContext(createT('pt-BR'))

export function useT() {
  return useContext(I18nContext)
}

export const t = createT('pt-BR')
