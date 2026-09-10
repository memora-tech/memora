import { Surface, Badge, Banner } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtBRL } from '../../lib/format.js'
import styles from './partner.module.css'

export function PartnerPositioning({ data }) {
  const t = useT()
  const { positioningTable, partner } = data
  const currentTier = partner.contract.positioningTier || positioningTable[0]?.tier

  return (
    <>
      <h1 className={styles.pageTitle}>{t('partner.positioning.title')}</h1>
      <Surface>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('partner.nav.positioning')}</th>
                <th scope="col">{t('partner.campaigns.form.description')}</th>
                <th scope="col" className={styles.num}>
                  {t('partner.positioning.perMonth')}
                </th>
              </tr>
            </thead>
            <tbody>
              {positioningTable.map((tier) => {
                const current = tier.tier === currentTier
                return (
                  <tr key={tier.tier} className={current ? styles.tierCurrent : undefined} aria-current={current ? 'true' : undefined}>
                    <td>
                      <strong>{tier.tier}</strong>
                      {current ? (
                        <div>
                          <Badge tone="brand" icon="check">
                            {t('partner.positioning.current')}
                          </Badge>
                        </div>
                      ) : null}
                    </td>
                    <td>{tier.description}</td>
                    <td className={styles.num}>{tier.monthlyBRL ? fmtBRL(tier.monthlyBRL) : t('partner.positioning.free')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Surface>
      <Banner tone="neutral" icon="info">
        {t('partner.positioning.rules')}
      </Banner>
    </>
  )
}
