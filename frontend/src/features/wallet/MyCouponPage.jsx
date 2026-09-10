import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import styles from './wallet.module.css'
import { Badge, Banner, Button, Chip, PageHeader, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'
import { qrMatrix } from '../../lib/qr.js'
import { storage } from '../../lib/storage.js'

export function MyCouponPage() {
  const t = useT()
  const toast = useToast()
  const { myCouponId } = useParams()
  const cacheKey = `memora.cache.coupon.${myCouponId}`
  const detail = useAsync(async () => {
    try {
      const data = await studentApi.get(`/wallet/coupons/${myCouponId}`)
      storage.set(cacheKey, data)
      return data
    } catch (err) {
      const cached = storage.get(cacheKey)
      if (cached && err.status === 0) return { ...cached, offline: true }
      throw err
    }
  }, [myCouponId])
  const data = detail.data
  const mine = data?.myCoupon
  useDocumentTitle(mine?.title)
  const matrix = useMemo(() => (data ? qrMatrix(data.qrPayload) : []), [data])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mine.code)
      toast.show({ message: t('wallet.mine.copied'), icon: 'copy' })
    } catch {
      toast.show({ message: mine.code })
    }
  }

  if (detail.loading && !data) return <Skeleton height={320} />
  if (detail.error && !data) return <Banner tone="danger" icon="alert">{t('wallet.coupon.notFound')}</Banner>
  if (!mine) return null

  const size = matrix.length

  return (
    <div className={styles.page}>
      <PageHeader title={mine.title} backTo="/app/carteira" actions={<Badge tone={mine.status === 'emitido' ? 'success' : mine.status === 'utilizado' ? 'neutral' : 'warning'}>{t(`wallet.mine.status.${mine.status}`, { date: fmtDate(mine.usedAt) })}</Badge>} />
      <Surface className={styles.qrCard}>
        <p className={styles.meta}>{mine.partnerName}</p>
        <svg className={styles.qr} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('wallet.mine.qrLabel', { code: mine.code })} shapeRendering="crispEdges">
          {matrix.map((row, r) => row.map((cell, c) => (cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#181818" /> : null)))}
        </svg>
        <span className={styles.code} aria-label={t('wallet.mine.code')}>
          {mine.code}
        </span>
        <Button variant="soft" icon="copy" onClick={copy}>
          {t('wallet.mine.copyCode')}
        </Button>
        <p className={styles.meta}>{t('wallet.mine.showAtStore')}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip tone="neutral" icon="clock">
            {t('wallet.mine.validUntil', { date: fmtDate(mine.validUntil) })}
          </Chip>
          <Chip tone="neutral">{t('wallet.mine.redeemedAt', { date: fmtDate(mine.redeemedAt) })}</Chip>
          <Chip tone="brand" icon="download">
            {t('wallet.mine.offline')}
          </Chip>
        </div>
        {data.coupon?.terms ? (
          <p className={styles.meta}>
            {t('wallet.coupon.terms')}: {data.coupon.terms}
          </p>
        ) : null}
      </Surface>
    </div>
  )
}
