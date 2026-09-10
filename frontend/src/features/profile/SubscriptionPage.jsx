import { useState } from 'react'
import styles from './profile.module.css'
import { Badge, Banner, Button, Chip, ChipButton, ConfirmDialog, Icon, PageHeader, ProgressBar, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtBRL, fmtDate } from '../../lib/format.js'

const METHODS_BY_CYCLE = { mensal: ['cartao', 'pix_automatico', 'pix'], anual: ['cartao', 'pix', 'boleto'] }

export function SubscriptionPage() {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const sub = useAsync(() => studentApi.get('/subscription'), [session.user?.plan])
  const [cycle, setCycle] = useState('mensal')
  const [method, setMethod] = useState('cartao')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('profile.subscription.title'))
  const s = sub.data

  const act = async (fn, message) => {
    setBusy(true)
    try {
      await fn()
      toast.show({ message, icon: 'check' })
      setDialog(null)
      await session.refresh()
      sub.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  if (sub.loading && !s) return <Skeleton height={160} count={2} />
  if (!s) return null

  const premium = s.plan === 'premium'
  const methods = METHODS_BY_CYCLE[cycle]
  const chosenMethod = methods.includes(method) ? method : methods[0]
  const refundOpen = premium && s.refundEligibleUntil && new Date(s.refundEligibleUntil).getTime() > Date.now()

  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.subscription.title')} backTo="/app/perfil" actions={<Chip tone={premium ? 'reward' : 'neutral'}>{premium ? t('profile.subscription.premium') : t('profile.subscription.free')}</Chip>} />

      {s.pendingActivation ? (
        <Banner tone="warning" icon="clock" action={<Button size="small" variant="soft" onClick={() => act(() => studentApi.post('/subscription/webhook', { eventId: `ev_${Date.now()}`, type: 'payment_confirmed' }), t('profile.subscription.subscribed'))}>{t('profile.subscription.simulateConfirm')}</Button>}>
          <strong>{t('profile.subscription.pendingTitle')}</strong> {t('profile.subscription.pendingText')}
        </Banner>
      ) : null}

      {s.dunning ? (
        <Banner tone="danger" icon="alert">
          {t('profile.subscription.dunning', { attempts: s.dunning.attempts, date: fmtDate(s.dunning.graceUntil || s.renewsAt) })}
        </Banner>
      ) : null}

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.subscription.limits')}</h2>
        <ul className={styles.benefits}>
          <li>
            <Icon name="check" size={16} /> {t('profile.subscription.limitDecks', { count: s.limits.decksPerDay })}
          </li>
          <li>
            <Icon name="check" size={16} /> {t('profile.subscription.limitTokens', { input: s.limits.generationTokens.input.toLocaleString('pt-BR'), output: s.limits.generationTokens.output.toLocaleString('pt-BR') })}
          </li>
          <li>
            <Icon name="check" size={16} /> {t('profile.subscription.limitPins', { count: s.limits.pinLimit })}
          </li>
          <li>
            <Icon name="check" size={16} /> {t('profile.subscription.limitSla', { hours: s.limits.slaHours })}
          </li>
        </ul>
        <p className={styles.meta}>{t('profile.subscription.noAds')}</p>
      </Surface>

      {premium ? (
        <>
          <Surface tone="brand" className={styles.stack}>
            <div className={styles.sectionTitle}>
              <span>{t('profile.subscription.fairUse')}</span>
              <Badge tone={s.fairUse?.degraded ? 'warning' : 'brand'}>{fmtBRL(s.fairUse?.usedBRL || 0)}</Badge>
            </div>
            <ProgressBar value={s.fairUse?.usedBRL || 0} max={s.fairUse?.capBRL || 20} tone={s.fairUse?.degraded ? 'warning' : undefined} label={t('profile.subscription.fairUseBar', { used: fmtBRL(s.fairUse?.usedBRL || 0), cap: fmtBRL(s.fairUse?.capBRL || 20) })} />
            <span className={styles.meta}>{t('profile.subscription.fairUseBar', { used: fmtBRL(s.fairUse?.usedBRL || 0), cap: fmtBRL(s.fairUse?.capBRL || 20) })}</span>
            <p className={styles.meta}>{s.fairUseExplained}</p>
            {s.fairUse?.degraded ? <p className={styles.meta}>{t('profile.subscription.degraded')}</p> : null}
          </Surface>

          <Surface className={styles.stack}>
            <div className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{t(`profile.subscription.${s.cycle === 'anual' ? 'yearly' : 'monthly'}`)}</span>
                <span className={styles.meta}>
                  {fmtBRL(s.priceBRL)} · {s.method}
                </span>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{s.cancelledAt ? t('profile.subscription.accessUntil', { date: fmtDate(s.accessUntil || s.renewsAt) }) : t('profile.subscription.renewsAt', { date: fmtDate(s.renewsAt) })}</span>
                <span className={styles.meta}>{s.cancelledAt ? '' : t('profile.subscription.renewalNotice')}</span>
              </div>
            </div>
            <p className={styles.meta}>{refundOpen ? t('profile.subscription.refundUntil', { date: fmtDate(s.refundEligibleUntil) }) : t('profile.subscription.refundClosed')}</p>
            <div className={styles.actions}>
              {!s.cancelledAt ? (
                <Button variant="ghost" onClick={() => setDialog('cancel')}>
                  {t('profile.subscription.cancel')}
                </Button>
              ) : null}
              {refundOpen ? (
                <Button variant="danger" onClick={() => setDialog('refund')}>
                  {t('profile.subscription.refund')}
                </Button>
              ) : null}
            </div>
          </Surface>
        </>
      ) : (
        <Surface className={styles.stack}>
          <h2 className={styles.sectionTitle}>{t('profile.subscription.premium')}</h2>
          <ul className={styles.benefits}>
            {(s.premiumBenefits || []).map((b) => (
              <li key={b}>
                <Icon name="zap" size={16} /> {b}
              </li>
            ))}
          </ul>
          <p className={styles.meta}>{t('profile.subscription.upsellHint')}</p>
          <div className={styles.priceGrid} role="radiogroup" aria-label={t('profile.subscription.cycle')}>
            <Surface tone="sunken" className={styles.priceCard} role="radio" aria-checked={cycle === 'mensal' ? 'true' : 'false'} onClick={() => setCycle('mensal')}>
              <span className={styles.priceLabel}>{t('profile.subscription.monthly')}</span>
              <span className={styles.price}>{t('profile.subscription.monthlyPrice', { price: fmtBRL(s.prices?.mensal ?? 29.9) })}</span>
            </Surface>
            <Surface tone="sunken" className={styles.priceCard} role="radio" aria-checked={cycle === 'anual' ? 'true' : 'false'} onClick={() => setCycle('anual')}>
              <span className={styles.priceLabel}>{t('profile.subscription.yearly')}</span>
              <span className={styles.price}>{t('profile.subscription.yearlyPrice', { price: fmtBRL(s.prices?.anual ?? 239.9) })}</span>
              <span className={styles.meta}>{t('profile.subscription.yearlyPerMonth', { price: fmtBRL(s.offer?.yearlyPerMonthBRL ?? (s.prices?.anual ?? 239.9) / 12) })}</span>
            </Surface>
          </div>
          <div className={styles.methodGroup}>
            <span className={styles.rowTitle} id="metodo-label">
              {t('profile.subscription.method')}
            </span>
            <div className={styles.chips} role="radiogroup" aria-labelledby="metodo-label">
              {methods.map((m) => (
                <ChipButton key={m} role="radio" pressed={chosenMethod === m} onClick={() => setMethod(m)}>
                  {t(`profile.subscription.methods.${m}`)}
                </ChipButton>
              ))}
            </div>
          </div>
          <Button size="large" icon="zap" onClick={() => setDialog('subscribe')}>
            {t('profile.subscription.subscribe')}
          </Button>
          <details className={styles.terms}>
            <summary className={styles.termsSummary}>{t('profile.subscription.terms')}</summary>
            <p className={styles.meta}>
              {t('profile.subscription.fairUse')}: {s.fairUseExplained}
            </p>
            <p className={styles.meta}>{s.refundPolicy}</p>
            <p className={styles.meta}>{s.cancelPolicy}</p>
          </details>
        </Surface>
      )}

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.subscription.payments')}</h2>
        {(s.payments || []).length ? (
          s.payments.map((p) => (
            <div key={p.id} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>
                  {fmtBRL(p.amountBRL)} · {p.method}
                </span>
                <span className={styles.meta}>
                  {fmtDate(p.at)} · {t(`profile.subscription.paymentStatus.${p.status}`)}
                  {p.nfse ? ` · ${t('profile.subscription.nfse', { number: p.nfse.number })}` : p.status === 'pago' ? ` · ${t('profile.subscription.nfsePending')}` : ''}
                </span>
              </div>
              {p.nfse ? <Button size="small" variant="text" icon="receipt" href={p.nfse.url} label={t('profile.subscription.nfse', { number: p.nfse.number })} /> : null}
            </div>
          ))
        ) : (
          <p className={styles.meta}>{t('profile.subscription.noPayments')}</p>
        )}
      </Surface>

      <ConfirmDialog
        open={dialog === 'subscribe'}
        onClose={() => setDialog(null)}
        title={t('profile.subscription.subscribeTitle')}
        confirmLabel={t('profile.subscription.subscribe')}
        loading={busy}
        onConfirm={() => act(() => studentApi.post('/subscription/subscribe', { cycle, method: chosenMethod }), t('profile.subscription.subscribed'))}
      >
        <p>{t('profile.subscription.subscribeText', { cycle: t(`profile.subscription.${cycle === 'anual' ? 'yearly' : 'monthly'}`), price: cycle === 'anual' ? t('profile.subscription.yearlyPrice', { price: fmtBRL(s.prices?.anual ?? 239.9) }) : t('profile.subscription.monthlyPrice', { price: fmtBRL(s.prices?.mensal ?? 29.9) }), method: t(`profile.subscription.methods.${chosenMethod}`) })}</p>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} title={t('profile.subscription.cancelTitle')} confirmLabel={t('profile.subscription.cancel')} loading={busy} onConfirm={() => act(() => studentApi.post('/subscription/cancel'), t('profile.subscription.cancelled'))}>
        <p>{t('profile.subscription.cancelText')}</p>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'refund'} onClose={() => setDialog(null)} title={t('profile.subscription.refundTitle')} confirmLabel={t('profile.subscription.refund')} danger loading={busy} onConfirm={() => act(() => studentApi.post('/subscription/refund'), t('profile.subscription.refunded'))}>
        <p>{t('profile.subscription.refundText')}</p>
      </ConfirmDialog>
    </div>
  )
}
