import express from 'express'
import cors from 'cors'
import { FEATURES } from './config/features.js'
import { createDataLayer } from './data/index.js'
import { isSupabaseConfigured } from './data/supabase.js'
import { buildCorsOptions, securityHeaders } from './lib/security.js'
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

export function createApp(store, options = {}) {
  const features = { ...FEATURES, ...(options.features || {}) }
  const data = options.data || createDataLayer({ serviceClient: options.serviceClient || null })
  const useSupabase =
    typeof options.useSupabase === 'boolean'
      ? options.useSupabase
      : Boolean(!store && isSupabaseConfigured())

  const app = express()
  app.disable('x-powered-by')
  app.use(securityHeaders())
  app.use(cors(buildCorsOptions()))
  app.use(express.json({ limit: '100kb' }))
  app.use((req, _res, next) => {
    req.store = store
    req.features = features
    req.data = data
    req.useSupabase = useSupabase
    if (options.serviceClient) req.serviceClient = options.serviceClient
    if (options.createUserClient) req.createUserClient = options.createUserClient
    if (options.inviteCode !== undefined) req.inviteCode = options.inviteCode
    if (options.aiGenerator) req.aiGenerator = options.aiGenerator
    if (options.aiChatGenerator) req.aiChatGenerator = options.aiChatGenerator
    next()
  })

  const v1 = express.Router()
  v1.get('/health', (_req, res) =>
    res.json({
      ok: true,
      seededAt: store?.state?.seededAt || null,
      profile: store?.state?.profile || 'mvp'
    })
  )
  v1.use(authRoutes(features))
  v1.use(meRoutes(features))
  v1.use(studyRoutes())
  v1.use(deckRoutes(features))
  v1.use(generationRoutes())
  v1.use(communityRoutes(features))
  if (features.materials) v1.use(materialRoutes())
  if (features.mcp) v1.use(mcpRoutes())
  v1.use(walletRoutes(features))
  if (features.subscriptions) v1.use(subscriptionRoutes())
  v1.use(privacyRoutes())
  if (features.supportTickets) v1.use(supportRoutes())
  v1.use(noaRoutes(features))
  v1.use(publicRoutes())
  if (features.panels) {
    v1.use('/parental', parentalRoutes())
    v1.use('/b2b', b2bRoutes())
    v1.use('/admin', adminRoutes())
    v1.use('/partner', partnerRoutes())
  }
  if (features.proto) v1.use('/_proto', protoRoutes())

  app.use('/v1', v1)

  app.use((req, res) => {
    res.status(404).json({ code: 'not_found', message: `Rota ${req.method} ${req.path} não existe.` })
  })

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : err.code === 'insufficient_balance' ? 422 : 500)
    res.status(status).json({ code: err.code || (status === 413 ? 'payload_too_large' : 'internal_error'), message: err.message })
  })

  return app
}
