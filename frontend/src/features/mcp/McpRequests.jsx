import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './mcp.module.css'
import { Banner, Button, ConfirmDialog, EmptyState, Icon, QACard, Screen, ScreenHeader, Sheet, Skeleton, TabBar, TabPanel, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative } from '../../lib/format.js'
import { Markdown } from '../community/Markdown.jsx'
import { MindMap } from '../community/MindMap.jsx'
import { KindTag } from '../community/kinds.jsx'
import { SimulateButton } from './SimulateButton.jsx'
import { decideRequest, useMcpRequests } from './arrivals.js'

const STATUSES = ['pendente', 'aprovado', 'recusado']

function Preview({ item, expanded }) {
  const t = useT()
  if (item.kind === 'flashcards') {
    const cards = expanded ? item.cards : item.cards.slice(0, 2)
    return (
      <ol className={styles.reqCards}>
        {cards.map((c, i) => (
          <li key={i}>
            <QACard as="div" index={i + 1} question={c.front} answer={c.back} />
          </li>
        ))}
      </ol>
    )
  }
  if (!item.body) return null
  if (item.kind === 'mapa') return expanded ? <MindMap root={item.body.root} /> : <p className={styles.reqLead}>{t('mcp.requests.mapSummary', { root: item.body.root.label, count: item.body.root.children.length })}</p>
  return (
    <div className={styles.reqText} data-expanded={expanded ? 'true' : 'false'}>
      <Markdown text={item.body.markdown} />
    </div>
  )
}

function RequestCard({ item, onApprove, onReject }) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const pending = item.status === 'pendente'
  const isDeck = item.kind === 'flashcards'
  return (
    <article className={styles.req} data-status={item.status} aria-labelledby={`req-${item.id}`}>
      <header className={styles.reqHead}>
        <KindTag kind={item.kind} small />
        <span className={styles.reqSource}>
          <Icon name="plug" size={14} /> {t('mcp.requests.from', { source: item.source })} · {fmtRelative(item.at)}
        </span>
        <span className={styles.reqStatus} data-status={item.status}>
          {t(`mcp.requests.status.${item.status}`)}
        </span>
      </header>
      <h2 id={`req-${item.id}`} className={styles.reqTitle}>
        {item.target.title}
      </h2>
      <p className={styles.reqMeta}>
        {item.target.categoryName}
        {isDeck ? ` · ${t('community.cards', { count: item.cards.length })}` : ''}
      </p>
      {item.target.description ? <p className={styles.reqLead}>{item.target.description}</p> : null}

      {item.status !== 'recusado' ? (
        <>
          <Preview item={item} expanded={expanded} />
          <Button variant="text" size="small" iconRight={expanded ? 'chevronUp' : 'chevronDown'} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded ? 'true' : 'false'}>
            {expanded ? t('mcp.requests.collapse') : isDeck ? t('mcp.requests.expandDeck', { count: item.cards.length }) : item.kind === 'mapa' ? t('mcp.requests.expandMap') : t('mcp.requests.expand')}
          </Button>
        </>
      ) : null}

      <footer className={styles.reqFoot}>
        {pending ? (
          <>
            <Button icon="check" onClick={() => onApprove(item)}>
              {isDeck ? t('mcp.requests.approveDeck') : t('mcp.requests.approve')}
            </Button>
            <Button variant="ghost" icon="x" onClick={() => onReject(item)}>
              {t('mcp.requests.reject')}
            </Button>
            <span className={styles.reqHint}>{t('mcp.requests.pendingHint')}</span>
          </>
        ) : item.status === 'aprovado' ? (
          <>
            <span className={styles.reqOutcome}>
              <Icon name="check" size={16} />
              {isDeck ? t('mcp.requests.outcomeDeck') : t(`mcp.requests.outcome.${item.target.status === 'aprovado' ? item.target.audience : item.target.status}`)}
            </span>
            {!item.target.deleted ? (
              <Button size="small" variant="ghost" to={isDeck ? `/app/decks/${item.target.id}` : `/app/comunidade/conteudo/${item.target.id}`}>
                {t('common.actions.open')}
              </Button>
            ) : null}
          </>
        ) : (
          <span className={styles.reqOutcome} data-tone="muted">
            <Icon name="trash" size={16} />
            {t('mcp.requests.outcomeRejected', { when: fmtRelative(item.decidedAt) })}
          </span>
        )}
      </footer>
    </article>
  )
}

export function McpRequests() {
  const t = useT()
  const toast = useToast()
  useDocumentTitle(t('mcp.requests.title'))
  const { data, error, reload } = useMcpRequests()
  const [tab, setTab] = useState('pendente')
  const [approving, setApproving] = useState(null)
  const [audience, setAudience] = useState('comunidade')
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)
  const items = (data?.items || []).filter((i) => i.status === tab).sort((a, b) => b.at.localeCompare(a.at))
  const counts = data?.counts || {}

  const approve = async () => {
    setBusy(true)
    try {
      const isDeck = approving.kind === 'flashcards'
      await decideRequest(approving.id, 'approve', isDeck ? { schedule: true } : { audience, acceptPolicy: true })
      toast.show({ message: isDeck ? t('mcp.requests.approvedDeck', { name: approving.target.title }) : t(`mcp.requests.approved.${audience}`), icon: 'check', duration: 6000 })
      setApproving(null)
      reload()
    } catch (err) {
      if (err.code === 'guardian_required') toast.show({ message: `${t('common.guardian.required')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
      else toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await decideRequest(rejecting.id, 'reject')
      toast.show({ message: t('mcp.requests.rejected', { name: rejecting.target.title }), icon: 'trash' })
      setRejecting(null)
      reload()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const destinations = [
    { value: 'comunidade', icon: 'globe', title: t('community.share.community'), text: t('community.share.communityText') },
    { value: 'seguidores', icon: 'users', title: t('community.share.followers'), text: t('community.share.followersText') },
    { value: 'privado', icon: 'lock', title: t('mcp.requests.privateTitle'), text: t('mcp.requests.privateText') }
  ]

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('mcp.requests.eyebrow')}
        title={t('mcp.requests.title')}
        lead={t('mcp.requests.lead')}
        actions={
          <>
            <SimulateButton size="small" kind="noticia" onDone={reload} />
            <SimulateButton size="small" onDone={reload} />
            <Button size="small" variant="ghost" icon="settings" to="/app/perfil/conexoes">
              {t('mcp.requests.connections')}
            </Button>
          </>
        }
      />

      <ol className={styles.flow} aria-label={t('mcp.arrival.journeyLabel')}>
        {['arrived', 'review', 'share', 'moderation', 'community'].map((step, i) => (
          <li key={step} className={styles.flowStep}>
            <span className={styles.flowNum} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.journeyText}>
              <span className={styles.journeyTitle}>{t(`mcp.requests.flow.${step}.title`)}</span>
              <span className={styles.flowHelp}>{t(`mcp.requests.flow.${step}.help`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <TabBar
        idBase="recebidos"
        label={t('mcp.requests.tabsLabel')}
        value={tab}
        onChange={setTab}
        tabs={STATUSES.map((s) => ({ value: s, label: t(`mcp.requests.tabs.${s}`), icon: { pendente: 'clock', aprovado: 'check', recusado: 'x' }[s], count: counts[s] || 0 }))}
      />

      <TabPanel idBase="recebidos" value={tab}>
        {!data && !error ? <Skeleton height={160} count={2} /> : null}
        {error && !data ? (
          <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={reload}>{t('common.actions.retry')}</Button>}>
            {t('common.state.error')}
          </Banner>
        ) : null}
        {data && !items.length ? <EmptyState icon={tab === 'pendente' ? 'check' : 'archive'} title={t(`mcp.requests.empty.${tab}`)} text={tab === 'pendente' ? t('mcp.requests.emptyPendingText') : null} /> : null}
        <div className={styles.reqList}>
          {items.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              onApprove={(r) => {
                setAudience('comunidade')
                setApproving(r)
              }}
              onReject={setRejecting}
            />
          ))}
        </div>
      </TabPanel>

      <Sheet
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title={t('mcp.requests.approveTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproving(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button icon="check" onClick={approve} loading={busy}>
              {approving?.kind === 'flashcards' ? t('mcp.requests.confirmDeck') : t(`mcp.requests.confirm.${audience}`)}
            </Button>
          </>
        }
      >
        {approving?.kind === 'flashcards' ? (
          <p className={styles.sheetText}>{t('mcp.requests.deckText', { name: approving.target.title })}</p>
        ) : approving ? (
          <>
            <p className={styles.sheetText}>{t('mcp.requests.whereTo', { name: approving.target.title })}</p>
            <div className={styles.destinations} role="radiogroup" aria-label={t('mcp.requests.approveTitle')}>
              {destinations.map((d) => (
                <button key={d.value} type="button" role="radio" aria-checked={audience === d.value ? 'true' : 'false'} className={styles.destination} onClick={() => setAudience(d.value)}>
                  <span className={styles.destinationIcon} aria-hidden="true">
                    <Icon name={d.icon} size={20} />
                  </span>
                  <span className={styles.destinationBody}>
                    <span className={styles.destinationTitle}>{d.title}</span>
                    <span className={styles.destinationText}>{d.text}</span>
                  </span>
                  <span className={styles.destinationCheck} aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                </button>
              ))}
            </div>
            {audience !== 'privado' ? <p className={styles.sheetHint}>{t('community.share.policy')}</p> : null}
          </>
        ) : null}
      </Sheet>

      <ConfirmDialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} onConfirm={reject} title={t('mcp.requests.rejectTitle')} confirmLabel={t('mcp.requests.reject')} danger loading={busy}>
        <p>{t('mcp.requests.rejectText', { name: rejecting?.target.title || '' })}</p>
      </ConfirmDialog>

      <p className={styles.footNote}>
        {t('mcp.requests.footNote')} <Link to="/app/perfil#meu-blog">{t('mcp.requests.myBlog')}</Link>
      </p>
    </Screen>
  )
}
