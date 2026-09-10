import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './create.module.css'
import { Banner, Button, Icon, Input, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'
import { ACTIVE_JOB_KEY } from '../../areas/student/LayoutBanners.jsx'

const ORDER = ['reading', 'generating', 'ready']
const STATE_INDEX = { criado: -1, na_fila: -1, lendo: 0, gerando: 1, pronto: 2, tentando_novamente: 0 }

export function GenerationProgress() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(120)
  const [busy, setBusy] = useState(false)
  const [restartKey, setRestartKey] = useState(0)
  useDocumentTitle(t('create.progress.title'))

  useEffect(() => {
    let timer
    let alive = true
    const poll = async () => {
      try {
        const data = await studentApi.get(`/generation/jobs/${jobId}`)
        if (!alive) return
        setJob(data.job)
        if (data.job.status === 'pronto') {
          navigate(`/app/criar/${jobId}/revisar`, { replace: true })
          return
        }
        if (!['falhou', 'cancelado', 'aprovado', 'acima_do_orcamento'].includes(data.job.status)) timer = setTimeout(poll, 700)
      } catch (err) {
        if (alive) setError(err)
      }
    }
    poll()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [jobId, navigate, restartKey])

  const scope = async (body) => {
    setBusy(true)
    try {
      const data = await studentApi.post(`/generation/jobs/${jobId}/scope`, body)
      setJob(data.job)
      setRestartKey((k) => k + 1)
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const retry = async () => {
    setBusy(true)
    try {
      const data = await studentApi.post(`/generation/jobs/${jobId}/retry`)
      setJob(data.job)
      setRestartKey((k) => k + 1)
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    try {
      await studentApi.post(`/generation/jobs/${jobId}/cancel`)
      storage.remove(ACTIVE_JOB_KEY)
      toast.show({ message: t('create.progress.cancelled') })
      navigate('/app/criar')
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  if (error) {
    return (
      <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => window.location.reload()}>{t('common.actions.retry')}</Button>}>
        {error.message}
      </Banner>
    )
  }

  if (!job) {
    return (
      <Surface>
        <Skeleton height={24} width="50%" />
        <div style={{ height: 12 }} />
        <Skeleton height={48} count={3} />
      </Surface>
    )
  }

  if (job.status === 'acima_do_orcamento') {
    const ob = job.overBudget
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('create.progress.overTitle')}</h1>
        <Surface tone="brand">
          <p>{t('create.progress.overText', { pages: ob.pages, maxPages: ob.maxPages })}</p>
        </Surface>
        <Surface>
          <div className={styles.rangeRow}>
            <Input label={t('create.progress.pagesFrom')} type="number" min={1} max={ob.pages} value={from} onChange={(e) => setFrom(Number(e.target.value))} inputMode="numeric" />
            <Input label={t('create.progress.pagesTo')} type="number" min={from} max={ob.pages} value={to} onChange={(e) => setTo(Number(e.target.value))} inputMode="numeric" />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <Button loading={busy} onClick={() => scope({ pages: [from, to] })}>
              {t('create.progress.choosePages')}
            </Button>
            <Button variant="ghost" loading={busy} onClick={() => scope({ split: true })}>
              {t('create.progress.split', { parts: Math.ceil(ob.sizeTokens / ob.budgetTokens) })}
            </Button>
          </div>
        </Surface>
        <Button variant="text" onClick={cancel}>
          {t('create.progress.cancel')}
        </Button>
      </div>
    )
  }

  if (job.status === 'falhou') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('create.progress.failedTitle')}</h1>
        <Banner tone="danger" icon="alert">
          {t('create.progress.failedText')}
        </Banner>
        <Surface>
          <p className={styles.meta}>{job.documentName}</p>
          <p className={styles.meta}>{t('create.progress.idempotent')}</p>
        </Surface>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button icon="refresh" loading={busy} onClick={retry}>
            {t('create.progress.retry')}
          </Button>
          <Button variant="ghost" icon="help" to="/app/perfil/suporte">
            {t('create.progress.support')}
          </Button>
          <Button variant="text" onClick={cancel}>
            {t('create.progress.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  const current = STATE_INDEX[job.status] ?? -1
  const retrying = job.status === 'tentando_novamente'

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('create.progress.title')}</h1>
      <Surface>
        <p className={styles.meta} style={{ marginBottom: 16 }}>
          {job.documentName}
          {job.pages ? ` · ${t('create.pages', { count: job.pages })}` : ''}
          {job.queuePosition ? ` · ${t('create.progress.queue', { position: job.queuePosition })}` : ''}
          {` · ${t('create.progress.priority', { priority: t(`create.progress.priorities.${job.plan}`) })}`}
        </p>
        <div className={styles.steps} role="list" aria-label={t('create.progress.title')}>
          {ORDER.map((step, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'todo'
            return (
              <div key={step} className={styles.step} role="listitem" aria-current={state === 'active' ? 'step' : undefined}>
                <span className={[styles.stepDot, state === 'active' && !retrying && styles.pulse].filter(Boolean).join(' ')} data-state={state}>
                  {state === 'done' ? <Icon name="check" size={16} /> : <span className="tabnum">{i + 1}</span>}
                </span>
                <span className={styles.stepLabel} data-state={state}>
                  {t(`create.progress.steps.${step}`)}
                </span>
              </div>
            )
          })}
        </div>
        {retrying ? (
          <Banner tone="warning" icon="refresh" className={styles.meta}>
            {t('create.progress.attempt', { attempt: job.attempt })} · {t('create.progress.retryIn', { seconds: job.retryInSec ?? 4 })}
          </Banner>
        ) : null}
        {job.readerModel || job.generatorModel ? <p className={styles.meta} style={{ marginTop: 12 }}>{t('create.progress.models', { reader: job.readerModel || '…', generator: job.generatorModel || '…' })}</p> : null}
      </Surface>
      <p className={styles.meta}>{t('create.progress.background')}</p>
      <p className={styles.meta}>{t('create.progress.idempotent')}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="soft" icon="book" to="/app">
          {t('create.progress.continueStudying')}
        </Button>
        <Button variant="text" onClick={cancel}>
          {t('create.progress.cancel')}
        </Button>
      </div>
    </div>
  )
}
