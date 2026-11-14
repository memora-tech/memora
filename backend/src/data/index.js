import { createAuditRepo } from './audit.repo.js'
import { createCommunityRepo } from './community.repo.js'
import { createDecksRepo } from './decks.repo.js'
import { createGenerationRepo } from './generation.repo.js'
import { createLedgerRepo } from './ledger.repo.js'
import * as mappers from './mappers.js'
import { createNoaRepo } from './noa.repo.js'
import { createProfilesRepo } from './profiles.repo.js'
import { createStudyRepo } from './study.repo.js'

export function createDataLayer({ serviceClient = null } = {}) {
  return {
    profiles: createProfilesRepo({ serviceClient }),
    decks: createDecksRepo(),
    study: createStudyRepo(),
    generation: createGenerationRepo({ serviceClient }),
    community: createCommunityRepo({ serviceClient }),
    noa: createNoaRepo({ serviceClient }),
    ledger: createLedgerRepo({ serviceClient }),
    audit: createAuditRepo({ serviceClient }),
    mappers
  }
}
