import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ai.module.css'
import { Badge, Button, Icon, Sheet } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { studentApi } from '../../lib/api.js'
import { fmtRelative } from '../../lib/format.js'

export const FORMATS = [
  { key: 'mapa', icon: 'mindmap', available: true },
  { key: 'flashcards', icon: 'layers', available: true },
  { key: 'resumo', icon: 'file', available: true },
  { key: 'diagrama', icon: 'route', available: true },
  { key: 'quiz', icon: 'quiz', available: true },
  { key: 'linha', icon: 'timeline', available: true }
]

export function buildCommand(t, formatKey, { title, topic, id } = {}) {
  const noun = t(`ai.formats.${formatKey}.noun`)
  if (title) return t('ai.command.fromCommunity', { title, noun, id: id || '?' })
  if (topic) return t('ai.command.fromTopic', { topic, noun })
  return t('ai.command.generic', { noun })
}

export function useAiConnections() {
  const [data, setData] = useState(null)
  const load = useCallback(async () => {
    try {
      setData(await studentApi.get('/mcp/connections'))
    } catch {
      setData({ connections: [], activity: [], tools: [] })
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const active = (data?.connections || []).filter((c) => c.active)
  return { data, active, reload: load, loading: !data }
}

export function CommandCopy({ command, compact }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={[styles.command, compact && styles.commandCompact].filter(Boolean).join(' ')}>
      <span className={styles.commandPrompt} aria-hidden="true">
        <Icon name="message" size={16} />
      </span>
      <q className={styles.commandText}>{command}</q>
      <button type="button" className={styles.commandCopy} onClick={copy} aria-label={copied ? t('ai.copied') : `${t('ai.copyCommand')}: ${command}`}>
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        <span aria-live="polite">{copied ? t('ai.copied') : t('common.actions.copy')}</span>
      </button>
    </div>
  )
}

export function FlowStrip() {
  const t = useT()
  const steps = [
    { key: 'ask', icon: 'message' },
    { key: 'build', icon: 'sparkle' },
    { key: 'review', icon: 'check' },
    { key: 'use', icon: 'users' }
  ]
  return (
    <ol className={styles.flow} aria-label={t('ai.flow.label')}>
      {steps.map((s, i) => (
        <li key={s.key} className={styles.flowStep}>
          <span className={styles.flowIcon} aria-hidden="true">
            <Icon name={s.icon} size={18} />
          </span>
          <span className={styles.flowText}>
            <span className={styles.flowTitle}>
              <span className="sr-only">{i + 1}. </span>
              {t(`ai.flow.${s.key}.title`)}
            </span>
            <span className={styles.flowHelp}>{t(`ai.flow.${s.key}.text`)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function FormatGallery({ topic }) {
  const t = useT()
  const ready = FORMATS.filter((f) => f.available)
  const soon = FORMATS.filter((f) => !f.available)
  return (
    <div className={styles.galleryWrap}>
      <ul className={styles.gallery}>
        {ready.map((f) => (
          <li key={f.key} className={styles.format} data-format={f.key} data-available="true">
            <span className={styles.formatHead}>
              <span className={styles.formatIcon} aria-hidden="true">
                <Icon name={f.icon} size={22} />
              </span>
              <span className={styles.formatTitle}>{t(`ai.formats.${f.key}.label`)}</span>
            </span>
            <span className={styles.formatArt} aria-hidden="true">
              <FormatArt kind={f.key} />
            </span>
            <span className={styles.formatText}>{t(`ai.formats.${f.key}.text`)}</span>
            <CommandCopy compact command={buildCommand(t, f.key, { topic })} />
          </li>
        ))}
      </ul>
      {soon.length ? (
        <ul className={styles.soonRow} aria-label={t('ai.soon')}>
          <li className={styles.soonLabel} aria-hidden="true">
            {t('ai.soon')}
          </li>
          {soon.map((f) => (
            <li key={f.key} className={styles.soonItem} data-format={f.key}>
              <span className={styles.formatIcon} aria-hidden="true">
                <Icon name={f.icon} size={18} />
              </span>
              <span className={styles.soonText}>
                <span className={styles.pickLabel}>{t(`ai.formats.${f.key}.label`)}</span>
                <span className={styles.statusMeta}>{t(`ai.formats.${f.key}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function FormatArt({ kind }) {
  if (kind === 'mapa') {
    return (
      <svg viewBox="0 0 160 72" className={styles.art}>
        <g stroke="currentColor" strokeWidth="1.5" opacity="0.5" fill="none">
          <path d="M80 36 C60 36 54 14 30 14" />
          <path d="M80 36 C60 36 54 58 30 58" />
          <path d="M80 36 C100 36 106 14 130 14" />
          <path d="M80 36 C100 36 106 58 130 58" />
        </g>
        <rect x="58" y="26" width="44" height="20" rx="10" fill="currentColor" />
        {[
          [12, 6],
          [12, 50],
          [112, 6],
          [112, 50]
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="36" height="16" rx="8" fill="currentColor" opacity="0.22" />
        ))}
      </svg>
    )
  }
  if (kind === 'flashcards') {
    return (
      <svg viewBox="0 0 160 72" className={styles.art}>
        <rect x="46" y="14" width="76" height="50" rx="8" fill="currentColor" opacity="0.14" transform="rotate(-7 84 39)" />
        <rect x="42" y="10" width="76" height="50" rx="8" fill="currentColor" opacity="0.24" transform="rotate(4 80 35)" />
        <rect x="40" y="10" width="80" height="52" rx="8" fill="var(--color-surface-raised)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="52" y="24" width="56" height="6" rx="3" fill="currentColor" opacity="0.7" />
        <rect x="52" y="38" width="38" height="5" rx="2.5" fill="currentColor" opacity="0.3" />
      </svg>
    )
  }
  if (kind === 'resumo') {
    return (
      <svg viewBox="0 0 160 72" className={styles.art}>
        <rect x="40" y="8" width="80" height="58" rx="6" fill="var(--color-surface-raised)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="50" y="17" width="40" height="6" rx="3" fill="currentColor" opacity="0.8" />
        {[30, 38, 46].map((y, i) => (
          <rect key={y} x="50" y={y} width={[60, 52, 44][i]} height="4" rx="2" fill="currentColor" opacity="0.28" />
        ))}
        <rect x="50" y="55" width="22" height="5" rx="2.5" fill="currentColor" opacity="0.55" />
      </svg>
    )
  }
  if (kind === 'diagrama') {
    return (
      <svg viewBox="0 0 160 72" className={styles.art}>
        <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55">
          <path d="M52 22 H70" />
          <path d="M106 22 H118 V44" />
          <path d="M118 52 V52" />
        </g>
        <rect x="14" y="12" width="38" height="20" rx="4" fill="currentColor" opacity="0.25" />
        <rect x="70" y="12" width="36" height="20" rx="4" fill="currentColor" />
        <path d="M118 42 L134 54 L118 66 L102 54 Z" fill="currentColor" opacity="0.3" />
      </svg>
    )
  }
  if (kind === 'linha') {
    return (
      <svg viewBox="0 0 160 72" className={styles.art}>
        <path d="M14 40 H146" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        {[30, 66, 102, 138].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="40" r="6" fill="currentColor" opacity={i === 1 ? 1 : 0.35} />
            <rect x={x - 14} y={i % 2 ? 50 : 18} width="28" height="8" rx="4" fill="currentColor" opacity="0.25" />
          </g>
        ))}
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 160 72" className={styles.art}>
      {[10, 30, 50].map((y, i) => (
        <g key={y}>
          <circle cx="48" cy={y + 6} r="6" fill={i === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" opacity={i === 1 ? 1 : 0.5} />
          <rect x="62" y={y + 3} width={[52, 60, 44][i]} height="6" rx="3" fill="currentColor" opacity={i === 1 ? 0.6 : 0.25} />
        </g>
      ))}
    </svg>
  )
}

export function TransformSheet({ open, onClose, item }) {
  const t = useT()
  const conns = useAiConnections()
  const title = item ? item.name || item.title : ''
  const options = FORMATS.filter((f) => f.key !== item?.kind)
  const [format, setFormat] = useState(options[0]?.key || 'mapa')
  useEffect(() => {
    if (open) {
      setFormat(FORMATS.find((f) => f.available && f.key !== item?.kind)?.key || 'mapa')
      conns.reload()
    }
  }, [open, item?.kind])
  const current = FORMATS.find((f) => f.key === format)
  const names = conns.active.map((c) => c.name).join(', ')

  return (
    <Sheet open={open} onClose={onClose} title={t('ai.transform.title')}>
      <div className={styles.transform}>
        <p className={styles.transformLead}>{t('ai.transform.lead', { title })}</p>
        <div role="radiogroup" aria-label={t('ai.transform.pick')} className={styles.pickGrid}>
          {options.map((f) => (
            <button key={f.key} type="button" role="radio" aria-checked={format === f.key ? 'true' : 'false'} className={styles.pick} data-format={f.key} disabled={!f.available} onClick={() => setFormat(f.key)}>
              <span className={styles.formatIcon} aria-hidden="true">
                <Icon name={f.icon} size={20} />
              </span>
              <span className={styles.pickLabel}>{t(`ai.formats.${f.key}.label`)}</span>
              {f.available ? null : <span className={styles.pickSoon}>{t('ai.soon')}</span>}
            </button>
          ))}
        </div>
        {current?.available ? (
          <div className={styles.transformCommand}>
            <span className={styles.label}>{t('ai.commandLabel')}</span>
            <CommandCopy command={buildCommand(t, format, { title, id: item?.id })} />
            <span className={styles.hint}>
              <Icon name="shield" size={14} /> {t('ai.transform.arrives')}
            </span>
          </div>
        ) : null}
        <div className={styles.transformStatus} data-connected={conns.active.length ? 'true' : 'false'}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.transformStatusText}>{conns.active.length ? t('ai.transform.connected', { count: conns.active.length, names }) : t('ai.transform.notConnected')}</span>
          <Button size="small" variant={conns.active.length ? 'ghost' : 'primary'} to={conns.active.length ? '/app/noa' : '/app/perfil/conexoes'}>
            {conns.active.length ? t('ai.transform.manage') : t('ai.transform.connect')}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

export function AiStatusCard({ pending = 0 }) {
  const t = useT()
  const conns = useAiConnections()
  if (conns.loading) return null
  return (
    <section className={styles.statusCard} aria-labelledby="ai-status-title">
      <header className={styles.statusHead}>
        <h2 id="ai-status-title" className={styles.statusTitle}>
          <Icon name="plug" size={16} /> {t('ai.status.title')}
        </h2>
        <span className={styles.statusCount} data-connected={conns.active.length ? 'true' : 'false'}>
          <span className={styles.statusDot} aria-hidden="true" />
          {conns.active.length ? t('ai.status.connected', { count: conns.active.length }) : t('ai.status.none')}
        </span>
      </header>
      {conns.active.length ? (
        <ul className={styles.statusList}>
          {conns.active.map((c) => (
            <li key={c.id} className={styles.statusRow}>
              <span className={styles.clientMark} aria-hidden="true">
                {c.name.slice(0, 1)}
              </span>
              <span className={styles.statusRowText}>
                <span className={styles.statusName}>{c.name}</span>
                <span className={styles.statusMeta}>{c.lastUsedAt ? t('ai.status.lastUsed', { when: fmtRelative(c.lastUsedAt) }) : t('ai.status.neverUsed')}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.statusMeta}>{t('ai.status.noneText')}</p>
      )}
      {pending ? (
        <Link to="/app/recebidos" className={styles.statusPending}>
          <span>{t('ai.status.pending', { count: pending })}</span>
          <span className={styles.statusPendingGo}>
            {t('ai.status.review')} <Icon name="arrowRight" size={14} />
          </span>
        </Link>
      ) : null}
      <Button size="small" variant={conns.active.length ? 'ghost' : 'primary'} icon={conns.active.length ? 'settings' : 'plug'} to="/app/perfil/conexoes" block>
        {conns.active.length ? t('ai.status.manage') : t('ai.status.connect')}
      </Button>
    </section>
  )
}
