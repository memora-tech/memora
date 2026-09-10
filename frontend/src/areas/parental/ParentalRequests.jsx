import { useState } from 'react'
import { parentalApi } from '../../lib/api.js'
import { Surface, Button, Badge, EmptyState, ConfirmDialog, SectionTitle, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtRelative } from '../../lib/format.js'
import styles from './parental.module.css'

export function ParentalRequests({ data, onChange }) {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const [denying, setDenying] = useState(null)
  const pending = data.requests.filter((r) => r.status === 'pendente')
  const decided = data.requests.filter((r) => r.status !== 'pendente')

  async function decide(request, approve) {
    setBusy(request.id)
    try {
      const res = await parentalApi.post(`/parental/requests/${request.id}/decide`, { approve })
      onChange({
        permissions: res.permissions,
        requests: data.requests.map((r) => (r.id === request.id ? res.request : r)),
        history: [{ at: res.request.decidedAt, text: `${approve ? t('parental.requests.aprovada') : t('parental.requests.negada')}: ${request.title}` }, ...data.history]
      })
      toast.show({ message: approve ? t('parental.requests.approvedToast') : t('parental.requests.deniedToast'), icon: approve ? 'check' : 'x' })
    } catch {
      toast.show({ message: t('parental.requests.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setBusy(null)
      setDenying(null)
    }
  }

  const statusTone = { aprovada: 'success', negada: 'danger', pendente: 'warning' }

  return (
    <>
      <div>
        <h1 className={styles.pageTitle}>{t('parental.requests.title')}</h1>
        <p className={styles.pageIntro}>{t('parental.requests.count', { count: pending.length })}</p>
      </div>

      <section aria-labelledby="pending-title">
        <SectionTitle as="h2">
          <span id="pending-title">{t('parental.requests.pending')}</span>
        </SectionTitle>
        <div className={styles.grid} style={{ marginTop: 'var(--space-3)' }}>
          {pending.length === 0 ? (
            <Surface>
              <EmptyState icon="check" title={t('parental.requests.empty')} text={t('parental.requests.emptyText')} />
            </Surface>
          ) : (
            pending.map((r) => (
              <Surface key={r.id}>
                <div className={styles.request}>
                  <div className={styles.requestHead}>
                    <h3 className={styles.requestTitle}>{r.title}</h3>
                    <Badge tone="warning">{t('parental.requests.pendente')}</Badge>
                  </div>
                  <p className={styles.requestDetail}>{r.detail}</p>
                  <span className={styles.requestMeta}>{t('parental.requests.requestedAt', { when: fmtRelative(r.createdAt) })}</span>
                  <div className={styles.requestActions}>
                    <Button variant="ghost" icon="x" onClick={() => setDenying(r)} disabled={busy === r.id}>
                      {t('parental.requests.deny')}
                    </Button>
                    <Button icon="check" onClick={() => decide(r, true)} loading={busy === r.id}>
                      {t('parental.requests.approve')}
                    </Button>
                  </div>
                </div>
              </Surface>
            ))
          )}
        </div>
      </section>

      {decided.length ? (
        <section aria-labelledby="decided-title">
          <SectionTitle as="h2">
            <span id="decided-title">{t('parental.requests.decided')}</span>
          </SectionTitle>
          <div className={styles.grid} style={{ marginTop: 'var(--space-3)' }}>
            {decided.map((r) => (
              <Surface key={r.id} tone="sunken">
                <div className={styles.request}>
                  <div className={styles.requestHead}>
                    <h3 className={styles.requestTitle}>{r.title}</h3>
                    <Badge tone={statusTone[r.status] || 'neutral'}>{t(`parental.requests.${r.status}`)}</Badge>
                  </div>
                  <p className={styles.requestDetail}>{r.detail}</p>
                  <span className={styles.requestMeta}>{t('parental.requests.decidedAt', { when: fmtRelative(r.decidedAt || r.createdAt) })}</span>
                </div>
              </Surface>
            ))}
          </div>
        </section>
      ) : null}

      <ConfirmDialog open={Boolean(denying)} onClose={() => setDenying(null)} onConfirm={() => denying && decide(denying, false)} title={t('parental.requests.confirmDenyTitle')} confirmLabel={t('parental.requests.confirmDeny')} cancelLabel={t('parental.requests.cancel')} danger loading={Boolean(busy)}>
        <p>{t('parental.requests.confirmDenyText')}</p>
      </ConfirmDialog>
    </>
  )
}
