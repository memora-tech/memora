import { useState } from 'react'
import { Link } from 'react-router-dom'
import { partnerApi } from '../../lib/api.js'
import { Surface, Badge, Banner, Button, ConfirmDialog, Icon, ListItem, EmptyState, Stat, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtBRL, fmtDate, fmtRelative, fmtNumber } from '../../lib/format.js'
import styles from './partner.module.css'

const STATUS_TONE = { emitido: 'brand', utilizado: 'success', expirado: 'neutral' }

export function PartnerOverview({ data, onChange }) {
  const t = useT()
  const toast = useToast()
  const { partner, alerts, billing, redemptions } = data
  const contract = partner.contract
  const stages = partner.approvalStages || []
  const [confirming, setConfirming] = useState(false)
  const [accepting, setAccepting] = useState(false)

  async function accept() {
    setAccepting(true)
    try {
      const res = await partnerApi.post('/partner/contract/accept')
      onChange({ partner: { ...partner, contract: res.contract } })
      toast.show({ message: t('partner.contract.acceptedToast'), icon: 'check' })
      setConfirming(false)
    } catch {
      toast.show({ message: t('partner.contract.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setAccepting(false)
    }
  }

  const recent = redemptions.slice(0, 5)

  return (
    <>
      <h1 className={styles.pageTitle}>{t('partner.nav.overview')}</h1>

      {alerts.length ? (
        <div className={styles.alerts} aria-label={t('partner.alerts.title')}>
          {alerts.map((a) => (
            <Banner key={a.id} tone="warning" icon="alert">
              <strong>{t(`partner.alerts.${a.type}`)}</strong>
              <div>{a.text}</div>
              <span className={styles.cardSub}>{fmtRelative(a.at)}</span>
            </Banner>
          ))}
        </div>
      ) : null}

      <div className={`${styles.grid} ${styles.grid2}`}>
        <Surface>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>{partner.name}</h2>
              <p className={styles.cardSub}>
                {t('partner.company.cnpj', { cnpj: partner.cnpj })} · {partner.category}
              </p>
            </div>
            <Badge tone={partner.verified ? 'success' : 'warning'} icon={partner.verified ? 'check' : 'clock'}>
              {partner.verified ? t('partner.company.verified') : t('partner.company.pending')}
            </Badge>
          </div>
          <p className={styles.cardSub}>{t('partner.company.stages')}</p>
          <ul className={styles.stages}>
            {[t('partner.company.stage1'), t('partner.company.stage2')].map((label, i) => {
              const done = stages.length > i
              return (
                <li key={label} className={`${styles.stage} ${done ? styles.stageDone : styles.stagePending}`}>
                  <Icon name={done ? 'check' : 'clock'} size={16} />
                  <span>
                    {label} · {done ? t('partner.company.done') : t('partner.company.waiting')}
                  </span>
                </li>
              )
            })}
          </ul>
          {partner.contact ? (
            <dl className={styles.definitions} style={{ marginTop: 'var(--space-4)' }}>
              <dt>{t('partner.company.contact')}</dt>
              <dd>
                {partner.contact}
                {partner.email ? ` · ${partner.email}` : ''}
              </dd>
            </dl>
          ) : null}
        </Surface>

        <Surface>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('partner.contract.title')}</h2>
            <Badge tone={contract.acceptedDigitally ? 'success' : 'warning'} icon={contract.acceptedDigitally ? 'check' : 'edit'}>
              {contract.acceptedDigitally ? (contract.acceptedAt ? t('partner.contract.accepted', { date: fmtDate(contract.acceptedAt) }) : t('partner.contract.acceptedNoDate')) : t('partner.contract.pending')}
            </Badge>
          </div>
          <dl className={styles.definitions}>
            <dt>{t('partner.contract.startedLabel')}</dt>
            <dd>{fmtDate(contract.startedAt)}</dd>
            <dt>{t('partner.contract.renewsLabel')}</dt>
            <dd>{fmtDate(contract.renewsAt)}</dd>
            <dt>{t('partner.nav.positioning')}</dt>
            <dd>{contract.positioningTier ? `${contract.positioningTier} · ${t('partner.contract.monthly', { value: fmtBRL(contract.positioningMonthlyBRL) })}` : t('partner.contract.noTier')}</dd>
          </dl>
          <div className={styles.notes} style={{ marginTop: 'var(--space-4)' }}>
            <Banner tone="neutral" icon="info">
              {t('partner.contract.minMonths', { months: contract.minMonths })}. {t('partner.contract.penalty', { penalty: contract.penalty })}.
            </Banner>
          </div>
          {!contract.acceptedDigitally ? (
            <div className={styles.actions}>
              <Button icon="check" onClick={() => setConfirming(true)}>
                {t('partner.contract.acceptCta')}
              </Button>
              <p className={styles.cardSub}>{t('partner.contract.external')}</p>
            </div>
          ) : null}
        </Surface>
      </div>

      <div className={`${styles.grid} ${styles.grid2}`}>
        <Surface tone="brand">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('partner.billing.title')}</h2>
          </div>
          <p className={styles.cardSub}>{billing.model}</p>
          <div className={styles.kpis} style={{ marginTop: 'var(--space-3)' }}>
            <Stat value={fmtBRL(billing.cpaBRL)} label={t('partner.billing.cpa')} />
            <Stat value={`${billing.commissionPct}%`} label={t('partner.billing.commission')} />
            <Stat value={billing.positioningMonthlyBRL ? fmtBRL(billing.positioningMonthlyBRL) : t('partner.billing.none')} label={t('partner.billing.positioning')} />
          </div>
          <p className={styles.cardSub} style={{ marginTop: 'var(--space-3)' }}>
            {t('partner.billing.cpaHelp')}
          </p>
        </Surface>

        <Surface>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('partner.redemptions.title')}</h2>
            <Button variant="text" size="small" to="/parceiro/painel/relatorio" iconRight="chevronRight">
              {t('partner.nav.report')}
            </Button>
          </div>
          {recent.length ? (
            <div className={styles.list}>
              {recent.map((r) => (
                <ListItem
                  key={r.id}
                  icon="qr"
                  title={<span className="tabnum">{r.code}</span>}
                  meta={r.status === 'utilizado' && r.usedAt ? t('partner.redemptions.usedAt', { date: fmtDate(r.usedAt) }) : r.status === 'expirado' ? t('partner.redemptions.redeemedAt', { when: fmtRelative(r.redeemedAt) }) : t('partner.redemptions.validUntil', { date: fmtDate(r.validUntil) })}
                  trailing={<Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`partner.redemptions.status.${r.status}`)}</Badge>}
                  chevron={false}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="qr" title={t('partner.redemptions.empty')} />
          )}
          <p className={styles.cardSub} style={{ marginTop: 'var(--space-3)' }}>
            {fmtNumber(redemptions.length)} {t('partner.redemptions.all').toLowerCase()} · <Link to="/parceiro/painel/validar">{t('partner.nav.validate')}</Link>
          </p>
        </Surface>
      </div>

      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={accept} title={t('partner.contract.confirmTitle')} confirmLabel={t('partner.contract.confirm')} cancelLabel={t('partner.contract.cancel')} loading={accepting}>
        <p>{t('partner.contract.confirmText', { months: contract.minMonths, penalty: contract.penalty })}</p>
      </ConfirmDialog>
    </>
  )
}
