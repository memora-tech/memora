import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

let browserClient = null

export function isSupabaseClientConfigured() {
  if (import.meta.env.MODE === 'test' && import.meta.env.VITE_ENABLE_SUPABASE_IN_TEST !== 'true') {
    return false
  }
  return Boolean(supabaseUrl && supabasePublishableKey)
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseClientConfigured()) return null
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }
  return browserClient
}

export const supabase = getSupabaseBrowserClient()

