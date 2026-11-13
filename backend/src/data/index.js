import { createAuditRepo } from './audit.repo.js'
import { createProfilesRepo } from './profiles.repo.js'

export function createDataLayer({ serviceClient = null } = {}) {
  return {
    profiles: createProfilesRepo({ serviceClient }),
    audit: createAuditRepo({ serviceClient })
  }
}

