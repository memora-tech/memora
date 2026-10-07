import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './mcp.module.css'
import { Button, Icon, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { studentApi } from '../../lib/api.js'
import { fmtRelative } from '../../lib/format.js'
import { useMcpInbox } from './arrivals.js'

const JOURNEY = ['arrived', 'review', 'share', 'moderation', 'community']

function MaterialArrival({ item, more, onDismiss }) {
  const t = useT()
  const navigate = useNavigate()
  const m = item.material
  const go = async (to) => {
    await onDismiss(item.id)
    navigate(to)
  }
  return (
    <section className={styles.alert} role="status" aria-live="polite" aria-labelledby={`arrival-${item.id}`}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.alertHead}>
        <span className={styles.pulse} aria-hidden="true">
          <Icon name="news" size={22} />
        </span>
        <div className={styles.alertHeadText}>
          <span className={styles.eyebrow}>
            {t('mcp.arrival.eyebrowPost', { source: item.source })} · {fmtRelative(item.at)}
          </span>
          <h2 id={`arrival-${item.id}`} className={styles.alertTitle}>
            {m.title}
          </h2>
          <span className={styles.alertMeta}>
            {m.categoryName} · {t('community.blog.minutes', { count: m.readingMinutes })}
            {more > 0 ? ` · ${t('mcp.arrival.more', { count: more })}` : ''}
          </span>
        </div>
        <button type="button" className={styles.close} onClick={() => onDismiss(item.id)} aria-label={t('mcp.arrival.dismiss')}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <p className={styles.postLead}>{m.description}</p>

      <ol className={styles.journey} aria-label={t('mcp.arrival.journeyLabel')}>
        {JOURNEY.map((step, i) => (
          <li key={step} className={styles.journeyStep} data-state={i === 0 ? 'done' : i === 1 ? 'current' : 'next'} aria-current={i === 1 ? 'step' : undefined}>
            <span className={styles.journeyDot} aria-hidden="true">
              {i === 0 ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className={styles.journeyText}>
              <span className={styles.journeyTitle}>{t(`mcp.arrival.journey.${step}.title`)}</span>
              <span className={styles.journeyHelp}>{t(`mcp.arrival.journey.${step}.help`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.alertActions}>
        <Button icon="send" onClick={() => go(`/app/comunidade/conteudo/${m.id}`)}>
          {t('mcp.arrival.reviewShare')}
        </Button>
        <Button variant="ghost" icon="news" onClick={() => go('/app/perfil#meu-blog')}>
          {t('mcp.arrival.openBlog')}
        </Button>
        <span className={styles.alertHint}>{t('mcp.arrival.postHint')}</span>
      </div>
    </section>
  )
}

export function McpArrivalAlert() {
  const t = useT()
  const toast = useToast()
  const study = useStudy()
  const navigate = useNavigate()
  const { items, dismiss } = useMcpInbox()
  const [busy, setBusy] = useState(false)
  const item = items[0]
  if (!item) return null
  if (item.material) return <MaterialArrival item={item} more={items.length - 1} onDismiss={dismiss} />

  const addToStudy = async () => {
    setBusy(true)
    try {
      await studentApi.patch(`/decks/${item.deck.id}`, { scheduled: true })
      toast.show({ message: t('mcp.arrival.added', { name: item.deck.name }), icon: 'check' })
      await dismiss(item.id)
      study.loadToday()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const open = async () => {
    await dismiss(item.id)
    navigate(`/app/decks/${item.deck.id}`)
  }

  return (
    <section className={styles.alert} role="status" aria-live="polite" aria-labelledby={`arrival-${item.id}`}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.alertHead}>
        <span className={styles.pulse} aria-hidden="true">
          <Icon name="plug" size={22} />
        </span>
        <div className={styles.alertHeadText}>
          <span className={styles.eyebrow}>
            {t('mcp.arrival.eyebrow', { source: item.source })} · {fmtRelative(item.at)}
          </span>
          <h2 id={`arrival-${item.id}`} className={styles.alertTitle}>
            {item.deck.name}
          </h2>
          <span className={styles.alertMeta}>
            {t('mcp.arrival.meta', { count: item.deck.cardCount, category: item.deck.categoryName })}
            {items.length > 1 ? ` · ${t('mcp.arrival.more', { count: items.length - 1 })}` : ''}
          </span>
        </div>
        <button type="button" className={styles.close} onClick={() => dismiss(item.id)} aria-label={t('mcp.arrival.dismiss')}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <ol className={styles.preview} aria-label={t('mcp.arrival.previewLabel')}>
        {item.preview.map((c, i) => (
          <li key={i} className={styles.previewCard}>
            <span className={styles.previewLabel}>{t('common.nav.question')}</span>
            <span className={styles.previewQ}>{c.front}</span>
            <span className={styles.previewLabel}>{t('common.nav.answer')}</span>
            <span className={styles.previewA}>{c.back}</span>
          </li>
        ))}
      </ol>

      <div className={styles.alertActions}>
        <Button icon="calendar" onClick={addToStudy} loading={busy}>
          {t('mcp.arrival.addToStudy')}
        </Button>
        <Button variant="ghost" icon="eye" onClick={open}>
          {t('mcp.arrival.review')}
        </Button>
        <span className={styles.alertHint}>{t('mcp.arrival.hint')}</span>
      </div>
    </section>
  )
}

export function McpArrivalWatcher() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { items, loaded } = useMcpInbox()
  const announced = useRef(null)

  useEffect(() => {
    if (!loaded) return
    if (announced.current === null) {
      announced.current = new Set(items.map((i) => i.id))
      return
    }
    const fresh = items.filter((i) => !announced.current.has(i.id))
    fresh.forEach((i) => announced.current.add(i.id))
    if (!fresh.length || location.pathname === '/app') return
    const latest = fresh[0]
    toast.show({
      message: t('mcp.arrival.toast', { source: latest.source, name: latest.deck?.name || latest.material?.title }),
      icon: 'plug',
      duration: 7000,
      action: { label: t('mcp.arrival.toastAction'), onClick: () => navigate('/app') }
    })
  }, [items, loaded, location.pathname, navigate, t, toast])

  return null
}
