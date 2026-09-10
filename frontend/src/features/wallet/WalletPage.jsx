import { useEffect, useState } from 'react'
import styles from './wallet.module.css'
import { Badge, Banner, Button, Chip, Icon, NeuronCounter, ProgressBar, Sheet, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate, fmtDateTime, fmtNumber } from '../../lib/format.js'
import { useSession } from '../../state/SessionContext.jsx'

export function ledgerLabel(t, entry) {
  const meta = entry.meta || {}
  return t(`wallet.entry.${entry.type}`, { goal: meta.goal, referred: meta.referred, clonedBy: meta.clonedBy, deckName: meta.deckName, name: meta.name, title: meta.title || '', partner: meta.partner, reason: meta.reason })
}

export function CouponListItem({ coupon, balance }) {
  const t = useT()
  const disabled = coupon.soldOut
  return (
    <Surface interactive to={`/app/carteira/cupom/${coupon.id}`} className={styles.couponCard} data-disabled={disabled ? 'true' : 'false'} aria-label={`${coupon.title}, ${coupon.partnerName}, ${t('wallet.cost', { count: coupon.costNeurons })}`}>
      <span className={styles.couponIcon}>
        <Icon name="gift" size={24} />
      </span>
      <span className={styles.couponBody}>
        <span className={styles.couponTitle}>
          <span className={styles.couponName}>{coupon.title}</span>
          {coupon.soldOut ? <Badge tone="danger">{t('wallet.stock.soldOut')}</Badge> : coupon.lastUnits ? <Badge tone="warning">{t('wallet.stock.lastUnits')}</Badge> : coupon.positioning ? <Badge tone="reward" icon="star">{t(`wallet.positioning.${coupon.positioning}`)}</Badge> : null}
        </span>
        <span className={styles.couponDesc}>
          {coupon.partnerName} · {coupon.description}
        </span>
        {!coupon.soldOut && coupon.costNeurons > balance ? <span className={styles.couponMeta}>{t('wallet.missing', { count: coupon.costNeurons - balance })}</span> : null}
      </span>
      <span className={styles.couponCost}>
        <Icon name="neuron" size={16} /> {coupon.costNeurons}
      </span>
    </Surface>
  )
}

function MyCouponRow({ mine }) {
  const t = useT()
  return (
    <Surface interactive to={`/app/carteira/meus/${mine.id}`} className={styles.couponCard}>
      <span className={styles.couponIcon}>
        <Icon name="qr" size={24} />
      </span>
      <span className={styles.couponBody}>
        <span className={styles.couponTitle}>
          <span className={styles.couponName}>{mine.title}</span>
          <Chip tone={mine.status === 'emitido' ? 'success' : mine.status === 'utilizado' ? 'neutral' : 'warning'}>{t(`wallet.mine.status.${mine.status}`, { date: fmtDate(mine.usedAt) })}</Chip>
        </span>
        <span className={styles.couponMeta}>
          {mine.partnerName} · {t('wallet.mine.validUntil', { date: fmtDate(mine.validUntil) })}
        </span>
        <span className={`${styles.couponMeta} ${styles.couponCode}`}>{mine.code}</span>
      </span>
      <Icon name="chevronRight" />
    </Surface>
  )
}

function LedgerList({ entries, grouped }) {
  const t = useT()
  if (!grouped) {
    return entries.map((e) => (
      <div key={e.id} className={styles.ledgerRow}>
        <span className={styles.ledgerText}>
          <span className={styles.ledgerLabel}>{ledgerLabel(t, e)}</span>
          <span className={styles.ledgerMeta}>
            {fmtDateTime(e.ts)} · {t('wallet.entry.balanceAfter', { count: fmtNumber(e.balanceAfter) })}
          </span>
        </span>
        <span className={`${styles.ledgerAmount} tabnum`} data-positive={e.amount > 0 ? 'true' : 'false'}>
          {e.amount > 0 ? `+${e.amount}` : e.amount}
        </span>
      </div>
    ))
  }
  const days = []
  for (const e of entries) {
    const key = e.ts.slice(0, 10)
    const last = days[days.length - 1]
    if (last && last.key === key) last.items.push(e)
    else days.push({ key, items: [e] })
  }
  return days.map((day) => (
    <div key={day.key} className={styles.ledgerDay}>
      <h3 className={styles.ledgerDayTitle}>{fmtDate(`${day.key}T12:00:00`)}</h3>
      {day.items.map((e) => (
        <div key={e.id} className={styles.ledgerRow}>
          <span className={styles.ledgerText}>
            <span className={styles.ledgerLabel}>{ledgerLabel(t, e)}</span>
            <span className={styles.ledgerMeta}>{t('wallet.entry.balanceAfter', { count: fmtNumber(e.balanceAfter) })}</span>
          </span>
          <span className={`${styles.ledgerAmount} tabnum`} data-positive={e.amount > 0 ? 'true' : 'false'}>
            {e.amount > 0 ? `+${e.amount}` : e.amount}
          </span>
        </div>
      ))}
    </div>
  ))
}

export function WalletPage() {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const wallet = useAsync(() => studentApi.get('/wallet'), [session.user?.balance])
  const store = useAsync(() => studentApi.get('/coupons'), [session.user?.balance])
  useDocumentTitle(t('wallet.title'))

  useEffect(() => {
    const handler = () => {
      wallet.run()
      store.run()
    }
    window.addEventListener('memora:wallet-changed', handler)
    window.addEventListener('memora:proto-changed', handler)
    return () => {
      window.removeEventListener('memora:wallet-changed', handler)
      window.removeEventListener('memora:proto-changed', handler)
    }
  }, [wallet, store])

  const w = wallet.data
  const coupons = store.data?.coupons || []

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(w.referral.code)
      toast.show({ message: t('wallet.referralCopied'), icon: 'copy' })
    } catch {
      toast.show({ message: w.referral.code })
    }
  }

  if (wallet.loading && !w) return <Skeleton height={160} count={3} />
  if (wallet.error && !w) {
    return (
      <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => wallet.run()}>{t('common.actions.retry')}</Button>}>
        {t('common.state.error')}
      </Banner>
    )
  }
  if (!w) return null

  const next = w.nextCoupon
  const affordable = coupons.filter((c) => !c.soldOut && c.costNeurons <= w.balance)
  const tooExpensive = coupons.filter((c) => !c.soldOut && c.costNeurons > w.balance)
  const soldOut = coupons.filter((c) => c.soldOut)
  const active = w.myCoupons.filter((m) => m.status === 'emitido')
  const archived = w.myCoupons.filter((m) => m.status !== 'emitido')

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('wallet.title')}</h1>

      <Surface className={styles.balanceCard}>
        <span className={styles.balanceLabel}>{t('wallet.balanceUnit')}</span>
        <span className={styles.balanceValue}>
          <NeuronCounter value={w.balance} size={36} />
        </span>
        {w.redeemable ? (
          <span className={styles.balanceNext}>{t('wallet.redeemableNow', { count: w.redeemableCount })}</span>
        ) : next ? (
          <>
            <span className={styles.balanceNext}>{t('wallet.nextCoupon', { count: next.missing, title: next.coupon.title })}</span>
            <div className={styles.progressWrap}>
              <ProgressBar value={w.balance} max={next.coupon.costNeurons} tone="reward" label={t('wallet.nextCoupon', { count: next.missing, title: next.coupon.title })} />
            </div>
          </>
        ) : (
          <span className={styles.balanceNext}>{t('wallet.allAffordable')}</span>
        )}
      </Surface>

      {!w.canRedeem.verified ? (
        <Banner tone="warning" icon="shield" action={<Button size="small" variant="soft" to="/confirmar">{t('common.verification.cta')}</Button>}>
          {t('wallet.verifyRequired')}
        </Banner>
      ) : !w.canRedeem.ok ? (
        <Banner tone="warning" icon="clock">
          {t('wallet.studyDaysRequired', { required: w.canRedeem.required, count: w.canRedeem.studyDays })}
        </Banner>
      ) : null}
      {w.abuseFlag ? (
        <Banner tone="neutral" icon="alert">
          {t('wallet.abuseFlag')}
        </Banner>
      ) : null}

      <section className={styles.section} aria-labelledby="sec-loja">
        <h2 id="sec-loja" className={styles.sectionTitle}>
          {t('wallet.store')}
        </h2>
        {affordable.length ? (
          <div className={styles.grid}>
            {affordable.map((c) => (
              <CouponListItem key={c.id} coupon={c} balance={w.balance} />
            ))}
          </div>
        ) : (
          <p className={styles.meta}>{t('wallet.noneAffordable')}</p>
        )}
        {tooExpensive.length ? (
          <details className={styles.group}>
            <summary className={styles.groupSummary}>{t('wallet.groupLocked', { count: tooExpensive.length })}</summary>
            <div className={styles.grid}>
              {tooExpensive.map((c) => (
                <CouponListItem key={c.id} coupon={c} balance={w.balance} />
              ))}
            </div>
          </details>
        ) : null}
        {soldOut.length ? (
          <details className={styles.group}>
            <summary className={styles.groupSummary}>{t('wallet.groupSoldOut', { count: soldOut.length })}</summary>
            <div className={styles.grid}>
              {soldOut.map((c) => (
                <CouponListItem key={c.id} coupon={c} balance={w.balance} />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="sec-meus">
        <h2 id="sec-meus" className={styles.sectionTitle}>
          {t('wallet.myCoupons')}
        </h2>
        {active.length ? (
          <div className={styles.grid}>
            {active.map((m) => (
              <MyCouponRow key={m.id} mine={m} />
            ))}
          </div>
        ) : (
          <p className={styles.meta}>{t('wallet.mine.noneActive')}</p>
        )}
        {archived.length ? (
          <details className={styles.group}>
            <summary className={styles.groupSummary}>{t('wallet.mine.archived', { count: archived.length })}</summary>
            <div className={styles.grid}>
              {archived.map((m) => (
                <MyCouponRow key={m.id} mine={m} />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="sec-mov">
        <h2 id="sec-mov" className={styles.sectionTitle}>
          {t('wallet.ledger')}
        </h2>
        <Surface>
          {w.ledger.length ? (
            <>
              <LedgerList entries={w.ledger.slice(0, 5)} />
              <Button variant="text" size="small" icon="list" onClick={() => setLedgerOpen(true)}>
                {t('wallet.ledgerAll', { count: w.ledger.length })}
              </Button>
            </>
          ) : (
            <p className={styles.meta}>{t('wallet.ledgerEmpty')}</p>
          )}
        </Surface>
      </section>

      <Surface tone="sunken">
        <details className={styles.earn}>
          <summary className={styles.groupSummary}>{t('wallet.howToEarn')}</summary>
          <ul className={styles.earnList}>
            {['earnDaily', 'earnGoal', 'earnObjective', 'earnClone', 'earnReferral'].map((k) => (
              <li key={k}>
                <Icon name="neuron" size={16} /> {t(`wallet.${k}`)}
              </li>
            ))}
          </ul>
          <p className={styles.meta}>{t('wallet.neverBuy')}</p>
        </details>
      </Surface>

      {w.referral && session.canEarn ? (
        <Surface tone="brand">
          <h2 className={styles.sectionTitle} style={{ marginBottom: 8 }}>
            {t('wallet.referral')}
          </h2>
          <p className={styles.meta}>{w.referral.rule}</p>
          <div className={styles.referralRow}>
            <span className={styles.referralCode}>{w.referral.code}</span>
            <Button size="small" variant="soft" icon="copy" onClick={copyReferral}>
              {t('wallet.referralCopy')}
            </Button>
          </div>
        </Surface>
      ) : null}

      <Sheet open={ledgerOpen} onClose={() => setLedgerOpen(false)} title={t('wallet.ledger')}>
        <LedgerList entries={w.ledger} grouped />
      </Sheet>
    </div>
  )
}
