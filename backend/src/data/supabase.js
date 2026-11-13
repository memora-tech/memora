import { createClient } from '@supabase/supabase-js'

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || ''
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url, publishableKey, secretKey }
}

export function isSupabaseConfigured() {
  const { url, publishableKey, secretKey } = getSupabaseConfig()
  return Boolean(url && publishableKey && secretKey)
}

export function createUserClient(jwt = null) {
  const { url, publishableKey } = getSupabaseConfig()
  if (!url || !publishableKey) {
    throw new Error('SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórias.')
  }
  const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {}
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: { headers }
  })
}

export function createServiceClient() {
  const { url, secretKey } = getSupabaseConfig()
  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias.')
  }
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

