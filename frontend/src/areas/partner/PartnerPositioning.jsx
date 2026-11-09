import { Badge, Icon, ScreenHeader } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtBRL } from '../../lib/format.js'
import { panelStyles } from '../shared/PanelShell.jsx'
import styles from './partner.module.css'

export function PartnerPositioning({ data }) {
  const t = useT()
  const { positioningTable, partner } = data
  const currentTier = partner.contract.positioningTier || positioningTable[0]?.tier

  return (
    <>
      <ScreenHeader size="compact" eyebrow={t('partner.shell.groups.commercial')} title={t('partner.positioning.title')} lead={t('partner.pages.positioningLead')} />
      <ol className={styles.tiers}>
        {positioningTable.map((tier, i) => {
          const current = tier.tier === currentTier
          return (
            <li key={tier.tier} className={styles.tier} data-current={current ? 'true' : undefined} aria-current={current ? 'true' : undefined}>
              <span className={styles.tierLevel} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 className={styles.tierName}>{tier.tier}</h2>
              <p className={styles.tierPrice}>
                {tier.monthlyBRL ? fmtBRL(tier.monthlyBRL) : t('partner.positioning.free')}
                {tier.monthlyBRL ? <small> {t('partner.positioning.perMonth')}</small> : null}
              </p>
              <p className={styles.tierDesc}>{tier.description}</p>
              {current ? (
                <span>
                  <Badge tone="brand" icon="check">
                    {t('partner.positioning.current')}
                  </Badge>
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
      <p className={panelStyles.callout}>
        <Icon name="info" size={18} />
        <span>{t('partner.positioning.rules')}</span>
      </p>
    </>
  )
}
