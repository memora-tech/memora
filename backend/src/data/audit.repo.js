import { appendAudit } from '../lib/audit.js'
import { createServiceClient, isSupabaseConfigured } from './supabase.js'

export function createAuditRepo({ serviceClient = null } = {}) {
  const getService = () => serviceClient || createServiceClient()

  return {
    async append({ actor, actorRole, action, target, details = {}, store = null }) {
      if (store?.state) {
        return appendAudit(store.state, { actor, actorRole, action, target, details })
      }
      if (!isSupabaseConfigured() && !serviceClient) {
        return null
      }
      const client = getService()
      const { data, error } = await client.rpc('append_audit_entry', {
        p_actor: String(actor),
        p_actor_role: String(actorRole),
        p_action: String(action),
        p_target: String(target),
        p_details: details || {}
      })
      if (error) throw error
      return data
    }
  }
}

