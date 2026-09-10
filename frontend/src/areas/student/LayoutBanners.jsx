import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Banner, Button } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { useSession } from '../../state/SessionContext.jsx'
import { isOffline, onConnectivity, studentApi } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'
import { useProto } from '../../state/ProtoContext.jsx'

export const ACTIVE_JOB_KEY = 'memora.generation.active'

function useActiveJob(skip) {
  const [job, setJob] = useState(null)
  useEffect(() => {
    if (skip) return undefined
    let timer
    const poll = async () => {
      const id = storage.get(ACTIVE_JOB_KEY)
      if (!id) {
        setJob(null)
        return
      }
      try {
        const data = await studentApi.get(`/generation/jobs/${id}`)
        if (['aprovado', 'cancelado'].includes(data.job.status)) {
          storage.remove(ACTIVE_JOB_KEY)
          setJob(null)
        } else {
          setJob(data.job)
        }
      } catch {
        setJob(null)
      }
    }
    poll()
    timer = setInterval(poll, 1500)
    return () => clearInterval(timer)
  }, [skip])
  return job
}

const STEP_LABEL = { criado: 'queued', na_fila: 'queued', lendo: 'reading', gerando: 'generating', tentando_novamente: 'retrying', pronto: 'ready', falhou: 'failed', acima_do_orcamento: 'overBudget' }

export function LayoutBanners() {
  const t = useT()
  const study = useStudy()
  const session = useSession()
  const proto = useProto()
  const navigate = useNavigate()
  const location = useLocation()
  const [offline, setOffline] = useState(isOffline())
  const [installDismissed, setInstallDismissed] = useState(() => storage.get('memora.install.dismissed', false))
  const [installEvent, setInstallEvent] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const onCreateRoute = location.pathname.startsWith('/app/criar')
  const job = useActiveJob(onCreateRoute)

  useEffect(() => onConnectivity((value) => setOffline(value)), [])

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const banners = []

  if (offline) {
    banners.push(
      <Banner key="offline" tone="warning" icon="wifiOff">
        <strong>{t('common.state.offline')}</strong> {t('common.state.offlineDetail')}
        {study.pendingCount > 0 ? ` ${t('common.state.offlinePending', { count: study.pendingCount })}.` : ''}
      </Banner>
    )
  }

  if (session.cached && !offline) {
    banners.push(
      <Banner key="cached" tone="neutral" icon="info">
        {t('study.home.cached')}
      </Banner>
    )
  }

  if (session.user && !session.user.canEarn) {
    banners.push(
      <Banner key="verify" tone="brand" icon="shield" action={<Button size="small" variant="soft" onClick={() => navigate('/confirmar')}>{t('common.verification.cta')}</Button>}>
        {t('common.verification.required', { action: t('common.verification.actions.earn') })}
      </Banner>
    )
  }

  if (job) {
    const key = STEP_LABEL[job.status] || 'queued'
    const ready = job.status === 'pronto'
    const failed = job.status === 'falhou'
    banners.push(
      <Banner
        key="job"
        tone={ready ? 'success' : failed ? 'danger' : 'brand'}
        icon={ready ? 'check' : failed ? 'alert' : 'refresh'}
        action={
          <Button size="small" variant={ready ? 'primary' : 'soft'} onClick={() => navigate(ready ? `/app/criar/${job.id}/revisar` : `/app/criar/${job.id}`)}>
            {ready ? t('create.banner.review') : t('create.banner.open')}
          </Button>
        }
      >
        <strong>{job.documentName}</strong> · {t(`create.banner.${key}`)}
        {job.queuePosition && !ready && !failed ? ` · ${t('create.progress.queue', { position: job.queuePosition })}` : ''}
      </Banner>
    )
  }

  const focusedRoute = location.pathname === '/app' || location.pathname === '/app/estudar'

  if (installEvent && !installDismissed && !offline && !focusedRoute) {
    banners.push(
      <Banner
        key="install"
        tone="brand"
        icon="download"
        action={
          <span style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                storage.set('memora.install.dismissed', true)
                setInstallDismissed(true)
              }}
            >
              {t('common.install.later')}
            </Button>
            <Button
              size="small"
              onClick={async () => {
                installEvent.prompt()
                await installEvent.userChoice
                setInstallEvent(null)
              }}
            >
              {t('common.install.action')}
            </Button>
          </span>
        }
      >
        <strong>{t('common.install.title')}</strong> {t('common.install.text')}
      </Banner>
    )
  }

  if (proto.notification?.undelivered && !proto.notification.shown) {
    banners.push(
      <Banner key="undelivered" tone="neutral" icon="bell" action={<Button size="small" variant="text" onClick={proto.dismissNotification}>{t('common.actions.close')}</Button>}>
        {proto.notification.reason}
      </Banner>
    )
  }

  if (banners.length <= 1) return banners
  if (expanded) {
    return [
      ...banners,
      <Button key="less" variant="text" size="small" icon="chevronUp" onClick={() => setExpanded(false)}>
        {t('common.state.fewerNotices')}
      </Button>
    ]
  }
  return [
    banners[0],
    <Button key="more" variant="text" size="small" icon="chevronDown" onClick={() => setExpanded(true)}>
      {t('common.state.moreNotices', { count: banners.length - 1 })}
    </Button>
  ]
}
