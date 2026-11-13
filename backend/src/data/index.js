import { createAuditRepo } from './audit.repo.js'
import { createLedgerRepo } from './ledger.repo.js'
import * as mappers from './mappers.js'
import { createProfilesRepo } from './profiles.repo.js'

export function createDataLayer({ serviceClient = null } = {}) {
  return {
    profiles: createProfilesRepo({ serviceClient }),
    ledger: createLedgerRepo({ serviceClient }),
    audit: createAuditRepo({ serviceClient }),
    mappers
  }
}
