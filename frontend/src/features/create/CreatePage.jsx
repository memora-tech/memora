import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './create.module.css'
import { FEATURES } from '../../config/features.js'
import { Banner, Button, Chip, Icon, Input, Panel, Screen, ScreenHeader, Sheet, Surface, Textarea, useToast } from '../../design-system/index.js'
import { fmtRelative } from '../../lib/format.js'
import { SimulateButton } from '../mcp/SimulateButton.jsx'
import { CommandCopy, buildCommand } from '../noa/AiFormats.jsx'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useProto } from '../../state/ProtoContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'
import { getSupabaseBrowserClient, isSupabaseClientConfigured } from '../../lib/supabase.js'
import { uid } from '../../lib/ids.js'
import { ACTIVE_JOB_KEY } from '../../areas/student/LayoutBanners.jsx'

const TOKENS_PER_BYTE = 0.25
const MAX_PDF_PAGES = 50
const IDEMPOTENCY_TTL_MS = 24 * 3600 * 1000

function idempotencyKeyFor(fingerprint) {
  const now = Date.now()
  const map = Object.fromEntries(Object.entries(storage.get('memora.idem', {})).filter(([, v]) => v.expiresAt > now))
  if (!map[fingerprint]) map[fingerprint] = { key: uid('idem'), expiresAt: now + IDEMPOTENCY_TTL_MS }
  storage.set('memora.idem', map)
  return map[fingerprint].key
}

async function countClientPdfPages(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null
  try {
    const buffer = await file.arrayBuffer()
    const raw = new TextDecoder('latin1').decode(new Uint8Array(buffer))
    const pageMatches = raw.match(/\/Type\s*\/Page(?!s)\b/g)
    if (pageMatches && pageMatches.length > 0) return pageMatches.length

    let declaredMax = 0
    const pagesNodeRegex = /\/Type\s*\/Pages\b[\s\S]{0,600}?\/Count\s+(\d+)/g
    let match = pagesNodeRegex.exec(raw)
    while (match !== null) {
      const val = Number(match[1])
      if (Number.isFinite(val) && val > declaredMax) declaredMax = val
      match = pagesNodeRegex.exec(raw)
    }
    return declaredMax > 0 ? declaredMax : null
  } catch {
    return null
  }
}

function McpDecksPanel() {
  const t = useT()
  const info = useAsync(() => studentApi.get('/mcp/connections'), [])
  const data = info.data
  const active = (data?.connections || []).filter((c) => c.active)
  const received = (data?.activity || []).filter((a) => a.ok && a.tool === 'salvar_flashcards' && a.targetType === 'deck')
  return (
    <Panel
      title={t('create.mcp.title')}
      icon="plug"
      labelledBy="mcp-decks"
      action={
        <span className={styles.mcpActions}>
          <SimulateButton size="small" onDone={() => info.run().catch(() => {})} />
          <Button size="small" variant="ghost" to="/app/perfil/conexoes">
            {active.length ? t('create.mcp.manage') : t('create.mcp.connect')}
          </Button>
        </span>
      }
    >
      <p className={styles.originHelp}>{active.length ? t('create.mcp.connected', { count: active.length, names: active.map((c) => c.name).join(', ') }) : t('create.mcp.none')}</p>
      <CommandCopy command={buildCommand(t, 'flashcards')} />
      <Link to="/app/noa" className={styles.mcpMore}>
        {t('create.mcp.formats')} <Icon name="arrowRight" size={14} />
      </Link>
      {received.length ? (
        <ul className={styles.mcpList}>
          {received.map((a) => (
            <li key={a.id}>
              <Link to={`/app/decks/${a.targetId}`} className={styles.mcpRow}>
                <span className={styles.originIcon}>
                  <Icon name="layers" size={20} />
                </span>
                <span className={styles.originBody}>
                  <span className={styles.originTitle}>{a.title}</span>
                  <span className={styles.originHelp}>{t('create.mcp.received', { when: fmtRelative(a.at) })}</span>
                </span>
                <Icon name="chevronRight" />
              </Link>
            </li>
          ))}
        </ul>
      ) : data ? (
        <p className={styles.originHelp}>{t('create.mcp.empty')}</p>
      ) : null}
    </Panel>
  )
}

export function CreatePage() {
  const t = useT()
  const session = useSession()
  const proto = useProto()
  const toast = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const [text, setText] = useState('')
  const [topic, setTopic] = useState('')
  const [emptyName, setEmptyName] = useState('')
  const [clipboard, setClipboard] = useState(false)
  const [limit, setLimit] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const cameraRef = useRef(null)
  const fileRef = useRef(null)
  const ankiRef = useRef(null)
  const quota = useAsync(() => studentApi.get('/generation/quota'), [session.user?.plan])
  useDocumentTitle(t('create.title'))

  useEffect(() => {
    if (!navigator.clipboard?.readText) return
    navigator.clipboard
      .readText()
      .then((value) => {
        if (value && value.trim().length > 20) {
          setClipboard(true)
          setText(value)
        }
      })
      .catch(() => {})
  }, [])

  const submit = async ({
    source,
    documentName,
    sizeTokens,
    pages = null,
    storagePath = null,
    textValue,
    fingerprint
  }) => {
    setBusy(true)
    setError(null)
    const scenario = proto.consumeNextGeneration()
    const body = {
      source,
      documentName,
      sizeTokens: scenario === 'big' ? 400000 : sizeTokens,
      ...(pages ? { pages } : {}),
      ...(storagePath ? { storagePath } : {}),
      text: textValue,
      scenario: scenario === 'fail' ? 'fail' : null
    }
    try {
      const data = await studentApi.request('/generation/jobs', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKeyFor(fingerprint) }
      })
      if (data.duplicate) toast.show({ message: t('create.progress.duplicate'), icon: 'info' })
      storage.set(ACTIVE_JOB_KEY, data.job.id)
      navigate(`/app/criar/${data.job.id}`)
    } catch (err) {
      if (err.code === 'daily_limit') setLimit(err.body)
      else if (err.code === 'content_filtered') setError(t('create.filtered', { message: err.message }))
      else if (err.code === 'pdf_page_limit') {
        setError(
          t('create.pdfPageLimit', {
            pages: err.body?.pages ?? MAX_PDF_PAGES + 1,
            maxPages: err.body?.maxPages ?? MAX_PDF_PAGES
          })
        )
      } else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitText = () =>
    submit({
      source: 'text',
      documentName: t('create.textDocumentName'),
      sizeTokens: Math.max(500, Math.round(text.length * TOKENS_PER_BYTE)),
      textValue: text,
      fingerprint: `text:${text.length}:${text.slice(0, 40)}`
    })

  const submitTopic = () => {
    const cleanTopic = topic.trim()
    if (!cleanTopic) return
    submit({
      source: 'topic',
      documentName: t('create.topicDocumentPrefix', { topic: cleanTopic }),
      sizeTokens: Math.max(500, Math.round(cleanTopic.length * TOKENS_PER_BYTE)),
      textValue: cleanTopic,
      fingerprint: `topic:${cleanTopic.toLowerCase()}`
    })
  }

  const onFile = (source) => async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
    let detectedPages = null
    let uploadedStoragePath = null

    if (source === 'file' && isPdf) {
      detectedPages = await countClientPdfPages(file)
      if (detectedPages && detectedPages > MAX_PDF_PAGES) {
        setError(t('create.pdfPageLimit', { pages: detectedPages, maxPages: MAX_PDF_PAGES }))
        return
      }
      if (isSupabaseClientConfigured() && session.user?.id) {
        const sb = getSupabaseBrowserClient()
        if (sb) {
          const safeName = String(file.name || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
          const candidatePath = `${session.user.id}/${Date.now()}_${safeName}`
          const { error: upErr } = await sb.storage
            .from('generation-uploads')
            .upload(candidatePath, file, {
              contentType: file.type || 'application/pdf',
              upsert: true
            })
          if (!upErr) {
            uploadedStoragePath = candidatePath
          }
        }
      }
    }

    const sizeTokens = Math.max(500, Math.round(file.size * TOKENS_PER_BYTE))
    submit({
      source,
      documentName: file.name,
      sizeTokens,
      pages: detectedPages,
      storagePath: uploadedStoragePath,
      textValue: '',
      fingerprint: `${source}:${file.name}:${file.size}`
    })
  }

  const createEmpty = async () => {
    if (!emptyName.trim()) return
    setBusy(true)
    try {
      const data = await studentApi.post('/generation/jobs', { source: 'empty', documentName: emptyName.trim() })
      const approved = await studentApi.post(`/generation/jobs/${data.job.id}/approve`, { name: emptyName.trim(), cards: [] })
      toast.show({ message: t('create.review.emptyDeck'), icon: 'check' })
      navigate(`/app/decks/${approved.deckId}`)
    } catch (err) {
      if (err.code === 'daily_limit') setLimit(err.body)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const q = quota.data

  return (
    <Screen>
      <ScreenHeader eyebrow={t('create.eyebrow')} title={t('create.title')} lead={t('create.lead')} actions={q ? <Chip tone={q.used >= q.limit ? 'warning' : 'neutral'}>{t('create.quota', { used: q.used, limit: q.limit })}</Chip> : null} />

      <Banner tone="neutral" icon="shield">
        {t('create.privacyNotice')}
      </Banner>

      {error ? (
        <Banner
          tone="danger"
          icon="alert"
          action={
            <Button size="small" variant="text" onClick={() => setError(null)}>
              {t('common.actions.close')}
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      <div className={styles.origins}>
        <Surface interactive className={styles.origin} onClick={() => cameraRef.current?.click()} disabled={busy}>
          <span className={styles.originIcon}>
            <Icon name="camera" size={24} />
          </span>
          <span className={styles.originBody}>
            <span className={styles.originTitle}>{t('create.origin.camera')}</span>
            <span className={styles.originHelp}>{t('create.origin.cameraHelp')}</span>
          </span>
          <Icon name="chevronRight" />
        </Surface>
        <Surface interactive className={styles.origin} onClick={() => fileRef.current?.click()} disabled={busy}>
          <span className={styles.originIcon}>
            <Icon name="file" size={24} />
          </span>
          <span className={styles.originBody}>
            <span className={styles.originTitle}>{t('create.origin.file')}</span>
            <span className={styles.originHelp}>{t('create.origin.fileHelp')}</span>
          </span>
          <Icon name="chevronRight" />
        </Surface>
        <Surface interactive tone={clipboard ? 'brand' : undefined} className={styles.origin} onClick={() => (clipboard ? submitText() : setMode('text'))} disabled={busy}>
          <span className={styles.originIcon}>
            <Icon name="clipboard" size={24} />
          </span>
          <span className={styles.originBody}>
            <span className={styles.originTitle}>
              {t('create.origin.text')}
              {clipboard ? (
                <Chip tone="brand" icon="zap">
                  {t('create.origin.textClipboard')}
                </Chip>
              ) : null}
            </span>
            <span className={styles.originHelp}>{t('create.origin.textHelp')}</span>
          </span>
          <Icon name="chevronRight" />
        </Surface>
        <Surface interactive className={styles.origin} onClick={() => setMode('topic')} disabled={busy}>
          <span className={styles.originIcon}>
            <Icon name="sparkles" size={24} />
          </span>
          <span className={styles.originBody}>
            <span className={styles.originTitle}>{t('create.origin.topic')}</span>
            <span className={styles.originHelp}>{t('create.origin.topicHelp')}</span>
          </span>
          <Icon name="chevronRight" />
        </Surface>
        <Surface interactive className={styles.origin} onClick={() => ankiRef.current?.click()} disabled={busy}>
          <span className={styles.originIcon}>
            <Icon name="upload" size={24} />
          </span>
          <span className={styles.originBody}>
            <span className={styles.originTitle}>{t('create.origin.anki')}</span>
            <span className={styles.originHelp}>{t('create.origin.ankiHelp')}</span>
          </span>
          <Icon name="chevronRight" />
        </Surface>
        <Surface interactive className={styles.origin} onClick={() => setMode('empty')} disabled={busy}>
          <span className={styles.originIcon}>
            <Icon name="layers" size={24} />
          </span>
          <span className={styles.originBody}>
            <span className={styles.originTitle}>{t('create.origin.empty')}</span>
            <span className={styles.originHelp}>{t('create.origin.emptyHelp')}</span>
          </span>
          <Icon name="chevronRight" />
        </Surface>
      </div>

      {FEATURES.mcp ? <McpDecksPanel /> : null}

      <input ref={cameraRef} className={styles.hidden} type="file" accept="image/*" capture="environment" onChange={onFile('camera')} aria-label={t('create.origin.camera')} />
      <input ref={fileRef} className={styles.hidden} type="file" accept=".pdf,image/*" onChange={onFile('file')} aria-label={t('create.origin.file')} />
      <input ref={ankiRef} className={styles.hidden} type="file" accept=".apkg" onChange={onFile('anki')} aria-label={t('create.origin.anki')} />

      <details className={styles.how}>
        <summary className={styles.howSummary}>{t('create.how')}</summary>
        {q ? <p className={styles.meta}>{t('create.budget', { input: q.tokens.input.toLocaleString('pt-BR'), output: q.tokens.output.toLocaleString('pt-BR') })}</p> : null}
        <p className={styles.meta}>{t('create.pipeline')}</p>
        <p className={styles.meta}>{t('create.governance')}</p>
        {FEATURES.subscriptions && q?.plan === 'free' ? <p className={styles.meta}>{t('create.quotaPremium', { limit: 10 })}</p> : null}
      </details>

      <Sheet
        open={mode === 'text'}
        onClose={() => setMode(null)}
        title={t('create.origin.text')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button loading={busy} disabled={!text.trim()} onClick={submitText}>
              {t('create.textSubmit')}
            </Button>
          </>
        }
      >
        <Textarea label={t('create.textLabel')} placeholder={t('create.textPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} rows={8} autoFocus />
        <p className={styles.meta} style={{ marginTop: 12 }}>
          {t('create.privacyNotice')}
        </p>
      </Sheet>

      <Sheet
        open={mode === 'topic'}
        onClose={() => setMode(null)}
        title={t('create.origin.topic')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button loading={busy} disabled={!topic.trim()} onClick={submitTopic}>
              {t('create.topicSubmit')}
            </Button>
          </>
        }
      >
        <Input label={t('create.topicLabel')} placeholder={t('create.topicPlaceholder')} value={topic} onChange={(e) => setTopic(e.target.value)} autoFocus />
        <p className={styles.meta} style={{ marginTop: 12 }}>
          {t('create.privacyNotice')}
        </p>
      </Sheet>

      <Sheet
        open={mode === 'empty'}
        onClose={() => setMode(null)}
        title={t('create.origin.empty')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button loading={busy} disabled={!emptyName.trim()} onClick={createEmpty}>
              {t('create.emptyCreate')}
            </Button>
          </>
        }
      >
        <Input label={t('create.emptyName')} value={emptyName} onChange={(e) => setEmptyName(e.target.value)} autoFocus />
      </Sheet>

      <Sheet
        open={Boolean(limit)}
        onClose={() => setLimit(null)}
        title={t('create.limitTitle', { limit: limit?.limit ?? 3 })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLimit(null)}>
              {t('common.actions.close')}
            </Button>
            {FEATURES.subscriptions && limit?.upsell ? (
              <Button to="/app/perfil/assinatura" icon="zap" onClick={() => setLimit(null)}>
                {t('create.upsell')}
              </Button>
            ) : null}
          </>
        }
      >
        <p>{FEATURES.subscriptions && limit?.upsell ? t('create.limitText', { premiumLimit: limit?.premiumLimit ?? 10 }) : t('create.limitTomorrow')}</p>
        {FEATURES.subscriptions && limit?.upsell ? <p className={styles.meta}>{t('create.limitTomorrow')}</p> : null}
      </Sheet>
    </Screen>
  )
}
