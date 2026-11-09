import { useState } from 'react'
import { Link } from 'react-router-dom'
import shared from '../community/community.module.css'
import styles from './connect.module.css'
import { Badge, Banner, Button, ConfirmDialog, Icon, Input, PageHeader, Segmented, Skeleton, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtRelative } from '../../lib/format.js'
import { SimulateButton } from '../mcp/SimulateButton.jsx'

function CopyBlock({ label, value, multiline }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={shared.copyBlock}>
      <span className={shared.filterGroupLabel}>{label}</span>
      <div className={shared.copyRow}>
        {multiline ? <pre className={shared.code}>{value}</pre> : <code className={shared.code}>{value}</code>}
        <Button size="small" variant="soft" icon={copied ? 'check' : 'copy'} onClick={copy} aria-live="polite">
          {copied ? t('mcp.copied') : t('mcp.copy')}
        </Button>
      </div>
    </div>
  )
}

function SetupSteps({ data }) {
  const t = useT()
  const active = (data?.connections || []).filter((c) => c.active)
  const steps = [
    { key: 'token', done: active.length > 0 },
    { key: 'paste', done: active.some((c) => c.lastUsedAt) },
    { key: 'ask', done: (data?.activity || []).some((a) => a.ok) }
  ]
  const current = steps.findIndex((s) => !s.done)
  return (
    <ol className={styles.setup} aria-label={t('mcp.setup.label')}>
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={s.key} className={styles.setupStep} data-state={state}>
            <span className={styles.setupMark} aria-hidden="true">
              {s.done ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <span className={styles.setupText}>
              <span className={styles.setupTitle}>
                {t(`mcp.setup.${s.key}.title`)}
                <span className="sr-only"> · {t(`mcp.setup.state.${state}`)}</span>
              </span>
              <span className={styles.setupHelp}>{t(`mcp.setup.${s.key}.text`)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const CLIENTS = ['claudeCode', 'desktop', 'chatgpt']

export function McpConnect() {
  const t = useT()
  const toast = useToast()
  useDocumentTitle(t('mcp.title'))
  const info = useAsync(() => studentApi.get('/mcp/connections'), [])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState(null)
  const [client, setClient] = useState('claudeCode')
  const [revokeTarget, setRevokeTarget] = useState(null)
  const data = info.data
  const endpoint = `${typeof window !== 'undefined' ? window.location.origin : ''}${data?.endpointPath || '/v1/mcp'}`

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await studentApi.post('/mcp/connections', { name: name.trim() })
      setFresh({ token: res.token, name: res.connection.name })
      setClient('claudeCode')
      setName('')
      info.run().catch(() => {})
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setCreating(false)
    }
  }

  const revoke = async () => {
    try {
      await studentApi.del(`/mcp/connections/${revokeTarget.id}`)
      toast.show({ message: t('mcp.connections.revokedToast') })
      setRevokeTarget(null)
      info.run().catch(() => {})
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const claudeCode = fresh ? `claude mcp add --transport http memora ${endpoint} --header "Authorization: Bearer ${fresh.token}"` : ''
  const json = fresh ? JSON.stringify({ mcpServers: { memora: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${fresh.token}` } } } }, null, 2) : ''
  const tools = data?.tools || []
  const writeTools = tools.filter((x) => x.write)
  const readTools = tools.filter((x) => !x.write)
  const reload = () => info.run().catch(() => {})

  return (
    <div className={[shared.page, shared.pageWide, styles.page].join(' ')}>
      <PageHeader
        title={t('mcp.title')}
        backTo="/app/noa"
        backLabel={t('noa.title')}
        actions={
          <>
            <SimulateButton size="small" onDone={reload} />
            <SimulateButton size="small" kind="noticia" onDone={reload} />
          </>
        }
      >
        {t('mcp.lead')}
      </PageHeader>

      <SetupSteps data={data} />

      <div className={styles.grid}>
        <div className={styles.col}>
          {fresh ? (
            <section className={[styles.card, styles.cardStrong].join(' ')} aria-labelledby="mcp-token-title">
              <h2 id="mcp-token-title" className={styles.cardTitle}>
                {t('mcp.create.tokenTitle', { name: fresh.name })}
              </h2>
              <Banner tone="warning" icon="key">
                {t('mcp.create.tokenWarning')}
              </Banner>
              <CopyBlock label="Token" value={fresh.token} />
              <span className={shared.filterGroupLabel}>{t('mcp.clients.label')}</span>
              <Segmented label={t('mcp.clients.label')} value={client} onChange={setClient} options={CLIENTS.map((c) => ({ value: c, label: t(`mcp.clients.${c}.name`) }))} />
              <p className={styles.muted}>{t(`mcp.clients.${client}.text`)}</p>
              {client === 'claudeCode' ? <CopyBlock label={t('mcp.create.claudeCode')} value={claudeCode} multiline /> : null}
              {client === 'desktop' ? <CopyBlock label={t('mcp.create.jsonConfig')} value={json} multiline /> : null}
              {client === 'chatgpt' ? <CopyBlock label={t('mcp.endpoint')} value={endpoint} /> : null}
              <Button variant="ghost" icon="check" onClick={() => setFresh(null)}>
                {t('mcp.create.done')}
              </Button>
            </section>
          ) : (
            <section className={[styles.card, styles.cardStrong].join(' ')} aria-labelledby="mcp-new">
              <h2 id="mcp-new" className={styles.cardTitle}>
                <Icon name="key" size={18} /> {t('mcp.create.title')}
              </h2>
              <p className={styles.muted}>{t('mcp.create.lead')}</p>
              <form className={styles.form} onSubmit={create}>
                <Input label={t('mcp.create.name')} placeholder={t('mcp.create.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} hint={t('mcp.create.limit', { count: data?.limits?.activeConnections ?? 5 })} />
                <Button type="submit" icon="key" loading={creating} disabled={!name.trim()}>
                  {t('mcp.create.submit')}
                </Button>
              </form>
              <ul className={styles.clientChips} aria-label={t('mcp.clients.worksWith')}>
                <li className={styles.clientChipsLabel} aria-hidden="true">
                  {t('mcp.clients.worksWith')}
                </li>
                {['Claude Desktop', 'Claude Code', 'ChatGPT', 'Cursor'].map((c) => (
                  <li key={c} className={styles.clientChip}>
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.card} aria-labelledby="mcp-endpoint">
            <h2 id="mcp-endpoint" className={styles.cardTitle}>
              <Icon name="globe" size={18} /> {t('mcp.endpoint')}
            </h2>
            <CopyBlock label={t('mcp.endpointHint')} value={endpoint} />
          </section>

          <Link to="/app/noa" className={styles.toNoa}>
            <span className={styles.toNoaIcon} aria-hidden="true">
              <Icon name="sparkle" size={20} />
            </span>
            <span className={styles.toNoaText}>
              <span className={styles.toNoaTitle}>{t('mcp.toNoa.title')}</span>
              <span className={styles.muted}>{t('mcp.toNoa.text')}</span>
            </span>
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>

        <div className={styles.col}>
          {info.loading && !data ? <Skeleton height={100} count={2} /> : null}
          {info.error && !data ? (
            <Banner
              tone="danger"
              icon="alert"
              action={
                <Button size="small" variant="soft" onClick={() => info.run()}>
                  {t('common.actions.retry')}
                </Button>
              }
            >
              {t('common.state.error')}
            </Banner>
          ) : null}

          {data ? (
            <>
              <section className={styles.card} aria-labelledby="mcp-conns">
                <h2 id="mcp-conns" className={styles.cardTitle}>
                  <Icon name="plug" size={18} /> {t('mcp.connections.title')}
                  <span className={styles.count}>{data.connections.filter((c) => c.active).length}</span>
                </h2>
                {data.connections.length ? (
                  <ul className={styles.connList}>
                    {data.connections.map((c) => (
                      <li key={c.id} className={styles.conn} data-active={c.active ? 'true' : 'false'}>
                        <span className={styles.clientMarkLarge} aria-hidden="true">
                          {c.name.slice(0, 1)}
                        </span>
                        <span className={styles.connBody}>
                          <span className={styles.connName}>
                            {c.name}
                            <span className={styles.connState}>
                              <span className={styles.dot} aria-hidden="true" />
                              {c.active ? t('mcp.connections.active') : t('mcp.connections.revoked')}
                            </span>
                          </span>
                          <span className={styles.muted}>
                            {t('mcp.connections.token', { hint: c.tokenHint })} · {c.lastUsedAt ? t('mcp.connections.lastUsed', { when: fmtRelative(c.lastUsedAt) }) : t('mcp.connections.neverUsed')}
                            {c.client ? ` · ${t('mcp.connections.client', { client: c.client })}` : ''}
                          </span>
                        </span>
                        {c.active ? (
                          <Button size="small" variant="ghost" onClick={() => setRevokeTarget(c)} aria-label={`${t('mcp.connections.revoke')} ${c.name}`}>
                            {t('mcp.connections.revoke')}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>{t('mcp.connections.empty')}</p>
                )}
              </section>

              <section className={styles.card} aria-labelledby="mcp-activity">
                <h2 id="mcp-activity" className={styles.cardTitle}>
                  <Icon name="clock" size={18} /> {t('mcp.activity.title')}
                </h2>
                {data.activity.length ? (
                  <ol className={styles.activity}>
                    {data.activity.map((a) => {
                      const to = a.targetType === 'material' ? `/app/comunidade/conteudo/${a.targetId}` : a.targetType === 'deck' ? `/app/decks/${a.targetId}` : null
                      const body = (
                        <>
                          <span className={styles.activityDot} data-ok={a.ok ? 'true' : 'false'} aria-hidden="true">
                            <Icon name={a.ok ? 'check' : 'alert'} size={14} />
                          </span>
                          <span className={styles.connBody}>
                            <span className={styles.activityTitle}>{a.title || a.tool}</span>
                            <span className={styles.muted}>
                              <code className={styles.inlineCode}>{a.tool}</code> · {fmtRelative(a.at)}
                              {a.ok ? '' : ` · ${t('mcp.activity.failed', { error: a.error || '' })}`}
                            </span>
                          </span>
                        </>
                      )
                      return (
                        <li key={a.id}>
                          {to ? (
                            <Link to={to} className={styles.activityRow}>
                              {body}
                            </Link>
                          ) : (
                            <div className={styles.activityRow}>{body}</div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p className={styles.muted}>{t('mcp.activity.empty')}</p>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>

      {tools.length ? (
        <section className={styles.toolsSection} aria-labelledby="mcp-tools">
          <h2 id="mcp-tools" className={styles.sectionTitle}>
            {t('mcp.tools.title')}
          </h2>
          <div className={styles.toolCols}>
            {[
              { key: 'write', list: writeTools, icon: 'download' },
              { key: 'read', list: readTools, icon: 'search' }
            ].map((group) => (
              <div key={group.key} className={styles.toolGroup} data-group={group.key}>
                <h3 className={styles.toolGroupTitle}>
                  <Icon name={group.icon} size={16} /> {t(`mcp.tools.group.${group.key}`)}
                  <Badge tone={group.key === 'write' ? 'brand' : 'neutral'}>{group.list.length}</Badge>
                </h3>
                <ul className={styles.toolList}>
                  {group.list.map((tool) => (
                    <li key={tool.name} className={styles.tool}>
                      <code className={styles.toolName}>{tool.name}</code>
                      <span className={styles.muted}>{tool.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.footGrid}>
        <Banner tone="neutral" icon="shield">
          {t('mcp.safety')}
        </Banner>
        <div className={styles.providers}>
          <span className={styles.cardTitle}>
            <Icon name="school" size={18} /> {t('mcp.providers.title')}
          </span>
          <p className={styles.muted}>{t('mcp.providers.text')}</p>
        </div>
      </div>

      <ConfirmDialog open={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} onConfirm={revoke} title={t('mcp.connections.revokeTitle', { name: revokeTarget?.name || '' })} confirmLabel={t('mcp.connections.revoke')} danger>
        <p>{t('mcp.connections.revokeText')}</p>
      </ConfirmDialog>
    </div>
  )
}
