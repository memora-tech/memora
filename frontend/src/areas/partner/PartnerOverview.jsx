import { useState } from 'react'
import { Link } from 'react-router-dom'
import { partnerApi } from '../../lib/api.js'
import { Panel, ScreenHeader, StatTile, Badge, Banner, Button, ConfirmDialog, Icon, useToast } from '../../design-system/index.js'
import { Meter, PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'
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
  const campaigns = data.campaigns || []
  const used = redemptions.filter((r) => r.status === 'utilizado').length
  const usePct = redemptions.length ? Math.round((used / redemptions.length) * 100) : 0
  const active = campaigns.filter((c) => !c.paused && c.stock > 0).length
  const paused = campaigns.filter((c) => c.paused).length
  const stock = campaigns.reduce((sum, c) => sum + Math.max(0, c.stock || 0), 0)
  const low = campaigns.filter((c) => c.stock > 0 && c.stock <= 3).length

  return (
    <>
      <ScreenHeader size="compact" eyebrow={t('partner.shell.groups.performance')} title={t('partner.nav.overview')} lead={t('partner.pages.overviewLead')} />

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

      <div className={panelStyles.kpis}>
        <StatTile size="compact" icon="gift" label={t('partner.pages.kpiRedemptions')} value={fmtNumber(redemptions.length)} />
        <StatTile
          size="compact"
          icon="check"
          label={t('partner.pages.kpiUsed')}
          value={fmtNumber(used)}
          note={
            <>
              <Meter value={usePct} tone={usePct >= 50 ? 'success' : 'warning'} label={t('partner.pages.useRate', { pct: usePct })} />
              <span>{t('partner.pages.useRate', { pct: usePct })}</span>
            </>
          }
        />
        <StatTile
          size="compact"
          icon="star"
          label={t('partner.pages.kpiActive')}
          value={fmtNumber(active)}
          note={
            paused ? (
              <Trend tone="neutral" icon="pause">
                {t('partner.pages.paused', { count: paused })}
              </Trend>
            ) : null
          }
        />
        <StatTile
          size="compact"
          icon="layers"
          label={t('partner.pages.kpiStock')}
          value={fmtNumber(stock)}
          note={
            low ? (
              <Trend tone="warning" icon="alert">
                {t('partner.pages.lowStock', { count: low })}
              </Trend>
            ) : (
              <Trend tone="success" icon="check">
                {t('partner.pages.stockOk')}
              </Trend>
            )
          }
        />
      </div>

      <div className={panelStyles.grid}>
        <Panel tone="quiet" title={t('partner.company.title')} icon="building" labelledBy="company-title">
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>{partner.name}</h3>
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
        </Panel>

        <Panel
          tone="quiet"
          title={t('partner.contract.title')}
          icon="file"
          labelledBy="contract-title"
          action={
            <Badge tone={contract.acceptedDigitally ? 'success' : 'warning'} icon={contract.acceptedDigitally ? 'check' : 'edit'}>
              {contract.acceptedDigitally ? (contract.acceptedAt ? t('partner.contract.accepted', { date: fmtDate(contract.acceptedAt) }) : t('partner.contract.acceptedNoDate')) : t('partner.contract.pending')}
            </Badge>
          }
        >
          <dl className={styles.definitions}>
            <dt>{t('partner.contract.startedLabel')}</dt>
            <dd>{fmtDate(contract.startedAt)}</dd>
            <dt>{t('partner.contract.renewsLabel')}</dt>
            <dd>{fmtDate(contract.renewsAt)}</dd>
            <dt>{t('partner.nav.positioning')}</dt>
            <dd>{contract.positioningTier ? `${contract.positioningTier} · ${t('partner.contract.monthly', { value: fmtBRL(contract.positioningMonthlyBRL) })}` : t('partner.contract.noTier')}</dd>
          </dl>
          <p className={panelStyles.callout}>
            <Icon name="info" size={18} />
            <span>
              {t('partner.contract.minMonths', { months: contract.minMonths })}. {t('partner.contract.penalty', { penalty: contract.penalty })}.
            </span>
          </p>
          {!contract.acceptedDigitally ? (
            <div className={styles.actions}>
              <Button icon="check" onClick={() => setConfirming(true)}>
                {t('partner.contract.acceptCta')}
              </Button>
              <p className={styles.cardSub}>{t('partner.contract.external')}</p>
            </div>
          ) : null}
        </Panel>
      </div>

      <div className={panelStyles.grid}>
        <Panel tone="quiet" title={t('partner.billing.title')} icon="receipt" labelledBy="billing-title">
          <p className={styles.cardSub}>{billing.model}</p>
          <dl className={styles.billing}>
            <div>
              <dt>{t('partner.billing.cpa')}</dt>
              <dd>{fmtBRL(billing.cpaBRL)}</dd>
            </div>
            <div>
              <dt>{t('partner.billing.commission')}</dt>
              <dd>{`${billing.commissionPct}%`}</dd>
            </div>
            <div>
              <dt>{t('partner.billing.positioning')}</dt>
              <dd>{billing.positioningMonthlyBRL ? fmtBRL(billing.positioningMonthlyBRL) : t('partner.billing.none')}</dd>
            </div>
          </dl>
          <p className={styles.cardSub}>{t('partner.billing.cpaHelp')}</p>
        </Panel>

        <Panel
          tone="quiet"
          title={t('partner.redemptions.title')}
          icon="qr"
          labelledBy="recent-title"
          action={
            <Button variant="text" size="small" to="/parceiro/painel/relatorio" iconRight="chevronRight">
              {t('partner.nav.report')}
            </Button>
          }
        >
          {recent.length ? (
            <ul className={styles.redemptions}>
              {recent.map((r) => (
                <li key={r.id} className={styles.redemption}>
                  <span className={styles.redemptionIcon} aria-hidden="true">
                    <Icon name="qr" size={18} />
                  </span>
                  <span className={styles.redemptionText}>
                    <span className={styles.redemptionCode}>{r.code}</span>
                    <span className={styles.redemptionMeta}>{r.status === 'utilizado' && r.usedAt ? t('partner.redemptions.usedAt', { date: fmtDate(r.usedAt) }) : r.status === 'expirado' ? t('partner.redemptions.redeemedAt', { when: fmtRelative(r.redeemedAt) }) : t('partner.redemptions.validUntil', { date: fmtDate(r.validUntil) })}</span>
                  </span>
                  <span className={styles.redemptionStatus}>
                    <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`partner.redemptions.status.${r.status}`)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty icon="qr" title={t('partner.redemptions.empty')} />
          )}
          <p className={styles.cardSub}>
            {t('partner.redemptions.total', { count: redemptions.length })} · <Link to="/parceiro/painel/validar">{t('partner.nav.validate')}</Link>
          </p>
        </Panel>
      </div>

      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={accept} title={t('partner.contract.confirmTitle')} confirmLabel={t('partner.contract.confirm')} cancelLabel={t('partner.contract.cancel')} loading={accepting}>
        <p>{t('partner.contract.confirmText', { months: contract.minMonths, penalty: contract.penalty })}</p>
      </ConfirmDialog>
    </>
  )
}
