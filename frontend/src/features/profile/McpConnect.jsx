import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from '../community/community.module.css'
import { Badge, Banner, Button, ConfirmDialog, Icon, Input, PageHeader, Skeleton, Surface, useToast } from '../../design-system/index.js'
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
    <div className={styles.copyBlock}>
      <span className={styles.filterGroupLabel}>{label}</span>
      <div className={styles.copyRow}>
        {multiline ? <pre className={styles.code}>{value}</pre> : <code className={styles.code}>{value}</code>}
        <Button size="small" variant="soft" icon={copied ? 'check' : 'copy'} onClick={copy} aria-live="polite">
          {copied ? t('mcp.copied') : t('mcp.copy')}
        </Button>
      </div>
    </div>
  )
}

export function McpConnect() {
  const t = useT()
  const toast = useToast()
  useDocumentTitle(t('mcp.title'))
  const info = useAsync(() => studentApi.get('/mcp/connections'), [])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState(null)
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

  const steps = t('mcp.how.steps')
  const claudeCode = fresh ? `claude mcp add --transport http memora ${endpoint} --header "Authorization: Bearer ${fresh.token}"` : ''
  const json = fresh ? JSON.stringify({ mcpServers: { memora: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${fresh.token}` } } } }, null, 2) : ''

  return (
    <div className={[styles.page, styles.pageWide].join(' ')}>
      <PageHeader title={t('mcp.title')} backTo="/app/perfil" backLabel={t('profile.title')} actions={<SimulateButton size="small" onDone={() => info.run().catch(() => {})} />}>
        {t('mcp.lead')}
      </PageHeader>

      <div className={styles.connectGrid}>
        <div className={styles.connectCol}>
          <Surface tone="noa" className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('mcp.how.title')}</h2>
            <ol className={styles.steps}>
              {(Array.isArray(steps) ? steps : []).map((s, i) => (
                <li key={i}>
                  <span className={styles.stepNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <CopyBlock label={t('mcp.endpoint')} value={endpoint} />
          </Surface>

          {fresh ? (
            <Surface className={styles.section} role="region" aria-labelledby="mcp-token-title">
              <h2 id="mcp-token-title" className={styles.sectionTitle}>
                {t('mcp.create.tokenTitle', { name: fresh.name })}
              </h2>
              <Banner tone="warning" icon="key">
                {t('mcp.create.tokenWarning')}
              </Banner>
              <CopyBlock label="Token" value={fresh.token} />
              <CopyBlock label={t('mcp.create.claudeCode')} value={claudeCode} multiline />
              <CopyBlock label={t('mcp.create.jsonConfig')} value={json} multiline />
              <Button variant="ghost" icon="check" onClick={() => setFresh(null)}>
                {t('mcp.create.done')}
              </Button>
            </Surface>
          ) : (
            <Surface className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('mcp.create.title')}</h2>
              <form className={styles.createForm} onSubmit={create}>
                <Input label={t('mcp.create.name')} placeholder={t('mcp.create.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} hint={t('mcp.create.limit', { count: data?.limits?.activeConnections ?? 5 })} />
                <Button type="submit" icon="key" loading={creating} disabled={!name.trim()}>
                  {t('mcp.create.submit')}
                </Button>
              </form>
            </Surface>
          )}
        </div>

        <div className={styles.connectCol}>
          {info.loading && !data ? <Skeleton height={100} count={2} /> : null}
          {info.error && !data ? (
            <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => info.run()}>{t('common.actions.retry')}</Button>}>
              {t('common.state.error')}
            </Banner>
          ) : null}

          {data ? (
            <>
              <section className={styles.section} aria-labelledby="mcp-conns">
                <h2 id="mcp-conns" className={styles.sectionTitle}>
                  {t('mcp.connections.title')}
                </h2>
                {data.connections.length ? (
                  <Surface className={styles.ranking}>
                    {data.connections.map((c) => (
                      <div key={c.id} className={styles.rankRow}>
                        <span className={styles.rankKind} data-kind={c.active ? 'mapa' : 'off'} aria-hidden="true">
                          <Icon name="plug" size={16} />
                        </span>
                        <span className={styles.rankBody}>
                          <span className={styles.rankName}>{c.name}</span>
                          <span className={styles.rankMeta}>
                            {t('mcp.connections.token', { hint: c.tokenHint })} · {c.lastUsedAt ? t('mcp.connections.lastUsed', { when: fmtRelative(c.lastUsedAt) }) : t('mcp.connections.neverUsed')}
                            {c.client ? ` · ${t('mcp.connections.client', { client: c.client })}` : ''}
                          </span>
                        </span>
                        {c.active ? (
                          <Button size="small" variant="ghost" onClick={() => setRevokeTarget(c)} aria-label={`${t('mcp.connections.revoke')} ${c.name}`}>
                            {t('mcp.connections.revoke')}
                          </Button>
                        ) : (
                          <Badge>{t('mcp.connections.revoked')}</Badge>
                        )}
                      </div>
                    ))}
                  </Surface>
                ) : (
                  <p className={styles.meta}>{t('mcp.connections.empty')}</p>
                )}
              </section>

              <section className={styles.section} aria-labelledby="mcp-tools">
                <h2 id="mcp-tools" className={styles.sectionTitle}>
                  {t('mcp.tools.title')}
                </h2>
                <ul className={styles.toolList}>
                  {data.tools.map((tool) => (
                    <li key={tool.name} className={styles.toolItem}>
                      <span className={styles.toolHead}>
                        <Badge tone={tool.write ? 'brand' : 'neutral'}>{tool.write ? t('mcp.tools.write') : t('mcp.tools.read')}</Badge>
                        <code className={styles.toolName}>{tool.name}</code>
                      </span>
                      <span className={styles.meta}>{tool.description}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.section} aria-labelledby="mcp-activity">
                <h2 id="mcp-activity" className={styles.sectionTitle}>
                  {t('mcp.activity.title')}
                </h2>
                {data.activity.length ? (
                  <Surface className={styles.ranking}>
                    {data.activity.map((a) => {
                      const to = a.targetType === 'material' ? `/app/comunidade/conteudo/${a.targetId}` : a.targetType === 'deck' ? `/app/decks/${a.targetId}` : null
                      const body = (
                        <>
                          <span className={styles.rankKind} data-kind={a.ok ? 'resumo' : 'off'} aria-hidden="true">
                            <Icon name={a.ok ? 'check' : 'alert'} size={16} />
                          </span>
                          <span className={styles.rankBody}>
                            <span className={styles.rankName}>{a.title || a.tool}</span>
                            <span className={styles.rankMeta}>
                              <code>{a.tool}</code> · {fmtRelative(a.at)}
                              {a.ok ? '' : ` · ${t('mcp.activity.failed', { error: a.error || '' })}`}
                            </span>
                          </span>
                        </>
                      )
                      return to ? (
                        <Link key={a.id} to={to} className={styles.rankRow}>
                          {body}
                        </Link>
                      ) : (
                        <div key={a.id} className={styles.rankRow}>
                          {body}
                        </div>
                      )
                    })}
                  </Surface>
                ) : (
                  <p className={styles.meta}>{t('mcp.activity.empty')}</p>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>

      <Banner tone="neutral" icon="shield">
        {t('mcp.safety')}
      </Banner>
      <Surface tone="sunken" className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('mcp.providers.title')}</h2>
        <p className={styles.meta}>{t('mcp.providers.text')}</p>
      </Surface>

      <ConfirmDialog open={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} onConfirm={revoke} title={t('mcp.connections.revokeTitle', { name: revokeTarget?.name || '' })} confirmLabel={t('mcp.connections.revoke')} danger>
        <p>{t('mcp.connections.revokeText')}</p>
      </ConfirmDialog>
    </div>
  )
}
