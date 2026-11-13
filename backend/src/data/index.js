import { createAuditRepo } from './audit.repo.js'
import { createDecksRepo } from './decks.repo.js'
import { createLedgerRepo } from './ledger.repo.js'
import * as mappers from './mappers.js'
import { createProfilesRepo } from './profiles.repo.js'
import { createStudyRepo } from './study.repo.js'

export function createDataLayer({ serviceClient = null } = {}) {
  return {
    profiles: createProfilesRepo({ serviceClient }),
    decks: createDecksRepo(),
    study: createStudyRepo(),
    ledger: createLedgerRepo({ serviceClient }),
    audit: createAuditRepo({ serviceClient }),
    mappers
  }
}
