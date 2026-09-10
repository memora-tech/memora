import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './wallet.module.css'
import { Badge, Banner, Button, Chip, ConfirmDialog, Icon, PageHeader, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { uid } from '../../lib/ids.js'
import { useSession } from '../../state/SessionContext.jsx'

export function CouponPage() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const { couponId } = useParams()
  const detail = useAsync(() => studentApi.get(`/coupons/${couponId}`), [couponId])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [idem] = useState(() => uid('redeem'))
  const data = detail.data
  const coupon = data?.coupon
  useDocumentTitle(coupon?.title)

  const redeem = async () => {
    setBusy(true)
    try {
      const res = await studentApi.post(`/coupons/${couponId}/redeem`, { idempotencyKey: idem })
      setConfirm(false)
      window.dispatchEvent(new CustomEvent('memora:wallet-changed'))
      session.refresh()
      toast.show({ message: t('wallet.coupon.redeemed'), tone: 'reward', icon: 'gift' })
      navigate(`/app/carteira/meus/${res.myCoupon.id}`, { replace: true })
    } catch (err) {
      setConfirm(false)
      if (err.code === 'sold_out') toast.show({ message: t('wallet.coupon.soldOut'), tone: 'danger' })
      else if (err.code === 'insufficient_balance') toast.show({ message: t('wallet.coupon.insufficient', { count: err.body.missing }), tone: 'danger' })
      else if (err.code === 'study_days_required') toast.show({ message: t('wallet.studyDaysRequired', { required: err.body.required, count: err.body.studyDays }), tone: 'danger' })
      else if (err.code === 'verification_required') toast.show({ message: t('wallet.verifyRequired'), tone: 'danger' })
      else toast.show({ message: err.message, tone: 'danger' })
      detail.run()
    } finally {
      setBusy(false)
    }
  }

  if (detail.loading && !data) return <Skeleton height={160} count={2} />
  if (detail.error && !data) return <Banner tone="danger" icon="alert">{t('wallet.coupon.notFound')}</Banner>
  if (!coupon) return null

  const canRedeem = data.canRedeem?.ok && coupon.affordable && !coupon.soldOut

  return (
    <div className={styles.page}>
      <PageHeader title={coupon.title} backTo="/app/carteira" actions={coupon.positioning ? <Badge tone="reward" icon="star">{t(`wallet.positioning.${coupon.positioning}`)}</Badge> : null} />
      <Surface className={styles.detailHead}>
        <span className={styles.couponIcon}>
          <Icon name="gift" size={24} />
        </span>
        <p>{coupon.description}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip tone="reward" icon="neuron">
            {t('wallet.cost', { count: coupon.costNeurons })}
          </Chip>
          <Chip tone="neutral" icon="clock">
            {t('wallet.validity', { days: coupon.validityDays })}
          </Chip>
          {coupon.soldOut ? <Chip tone="danger">{t('wallet.stock.soldOut')}</Chip> : coupon.lastUnits ? <Chip tone="warning">{t('wallet.stock.lastUnits')}</Chip> : <Chip tone="neutral">{t('wallet.coupon.stockLeft', { count: coupon.stock })}</Chip>}
        </div>
        <p className={styles.meta}>
          {t('wallet.coupon.partner')}: {coupon.partnerName}
          {data.partner?.verified ? ` · ${t('wallet.coupon.verified')}` : ''} · {data.partner?.category}
        </p>
        <p className={styles.meta}>
          {t('wallet.coupon.terms')}: {coupon.terms}
        </p>
      </Surface>

      {!coupon.affordable && !coupon.soldOut ? (
        <Banner tone="neutral" icon="neuron">
          {t('wallet.coupon.insufficient', { count: coupon.costNeurons - data.balance })}
        </Banner>
      ) : null}
      {!data.canRedeem?.ok ? (
        <Banner tone="warning" icon="clock">
          {data.canRedeem?.verified ? t('wallet.studyDaysRequired', { required: data.canRedeem.required, count: data.canRedeem.studyDays }) : t('wallet.verifyRequired')}
        </Banner>
      ) : null}

      <Button size="large" icon="gift" disabled={!canRedeem} onClick={() => setConfirm(true)}>
        {t('wallet.coupon.redeem')}
      </Button>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={redeem} title={t('wallet.coupon.confirmTitle', { title: coupon.title })} confirmLabel={t('wallet.coupon.redeem')} loading={busy}>
        <p>{t('wallet.coupon.confirmText', { cost: coupon.costNeurons, balance: data.balance, days: coupon.validityDays })}</p>
      </ConfirmDialog>
    </div>
  )
}
