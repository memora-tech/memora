import express from 'express'
import cors from 'cors'
import { authRoutes } from './routes/auth.js'
import { meRoutes } from './routes/me.js'
import { studyRoutes } from './routes/study.js'
import { deckRoutes } from './routes/decks.js'
import { generationRoutes } from './routes/generation.js'
import { communityRoutes } from './routes/community.js'
import { materialRoutes } from './routes/materials.js'
import { mcpRoutes } from './routes/mcp.js'
import { walletRoutes } from './routes/wallet.js'
import { subscriptionRoutes } from './routes/subscription.js'
import { privacyRoutes } from './routes/privacy.js'
import { supportRoutes } from './routes/support.js'
import { noaRoutes } from './routes/noa.js'
import { protoRoutes } from './routes/proto.js'
import { publicRoutes } from './routes/public.js'
import { parentalRoutes } from './routes/parental.js'
import { b2bRoutes } from './routes/b2b.js'
import { adminRoutes } from './routes/admin.js'
import { partnerRoutes } from './routes/partner.js'

export function createApp(store) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use((req, _res, next) => {
    req.store = store
    next()
  })

  const v1 = express.Router()
  v1.get('/health', (_req, res) => res.json({ ok: true, seededAt: store.state.seededAt, profile: store.state.profile }))
  v1.use(authRoutes())
  v1.use(meRoutes())
  v1.use(studyRoutes())
  v1.use(deckRoutes())
  v1.use(generationRoutes())
  v1.use(communityRoutes())
  v1.use(materialRoutes())
  v1.use(mcpRoutes())
  v1.use(walletRoutes())
  v1.use(subscriptionRoutes())
  v1.use(privacyRoutes())
  v1.use(supportRoutes())
  v1.use(noaRoutes())
  v1.use(publicRoutes())
  v1.use('/parental', parentalRoutes())
  v1.use('/b2b', b2bRoutes())
  v1.use('/admin', adminRoutes())
  v1.use('/partner', partnerRoutes())
  v1.use('/_proto', protoRoutes())

  app.use('/v1', v1)

  app.use((req, res) => {
    res.status(404).json({ code: 'not_found', message: `Rota ${req.method} ${req.path} não existe.` })
  })

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'insufficient_balance' ? 422 : 500)
    res.status(status).json({ code: err.code || 'internal_error', message: err.message })
  })

  return app
}
