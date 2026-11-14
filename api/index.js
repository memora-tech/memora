import '../backend/src/config/env.js'
import { createApp } from '../backend/src/app.js'
import { isSupabaseConfigured } from '../backend/src/data/supabase.js'

const app = createApp(null, { useSupabase: isSupabaseConfigured() })

export default app
