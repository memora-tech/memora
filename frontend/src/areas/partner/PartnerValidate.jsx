import { useState } from 'react'
import { partnerApi, ApiError } from '../../lib/api.js'
import { Surface, Button, Input, Banner } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDateTime } from '../../lib/format.js'
import styles from './partner.module.css'

const TONES = { ok: 'success', already_used: 'danger', expired: 'warning', not_found: 'neutral', error: 'danger' }
const ICONS = { ok: 'check', already_used: 'x', expired: 'clock', not_found: 'search', error: 'alert' }

export function PartnerValidate({ data, onChange }) {
  const t = useT()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) {
      setError(t('partner.validate.error'))
      return
    }
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const res = await partnerApi.post('/partner/redemptions/validate', { code: clean })
      setResult({ kind: 'ok', code: res.code, usedAt: res.usedAt })
      onChange((prev) => ({ ...prev, redemptions: prev.redemptions.map((r) => (r.code === res.code ? { ...r, status: 'utilizado', usedAt: res.usedAt } : r)) }))
      setCode('')
    } catch (err) {
      if (err instanceof ApiError && ['already_used', 'expired', 'not_found'].includes(err.code)) {
        setResult({ kind: err.code, code: clean, usedAt: err.body?.usedAt })
      } else {
        setResult({ kind: 'error', code: clean })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div>
        <h1 className={styles.pageTitle}>{t('partner.validate.title')}</h1>
        <p className={styles.pageIntro}>{t('partner.validate.intro')}</p>
      </div>

      <Surface as="form" onSubmit={submit} noValidate>
        <div className={styles.validateForm}>
          <Input id="redeem-code" label={t('partner.validate.code')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} error={error} placeholder={t('partner.validate.placeholder')} className={styles.codeInput} autoComplete="off" spellCheck={false} />
          <Button type="submit" size="large" icon="check" loading={loading}>
            {t('partner.validate.submit')}
          </Button>
        </div>
        {result ? (
          <div className={styles.result}>
            <Banner tone={TONES[result.kind]} icon={ICONS[result.kind]}>
              <strong>{result.kind === 'error' ? t('partner.validate.genericError') : t(`partner.validate.${result.kind}`)}</strong>
              <div>
                {result.kind === 'ok' ? t('partner.validate.okText', { code: result.code, date: fmtDateTime(result.usedAt) }) : null}
                {result.kind === 'already_used' ? (result.usedAt ? t('partner.validate.usedAtText', { date: fmtDateTime(result.usedAt) }) : null) : null}
                {result.kind === 'expired' ? t('partner.validate.expiredText') : null}
                {result.kind === 'not_found' ? t('partner.validate.notFoundText') : null}
              </div>
            </Banner>
          </div>
        ) : null}
      </Surface>

      <Surface tone="sunken">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('partner.validate.apiTitle')}</h2>
        </div>
        <p className={styles.cardSub}>{data.api.docs}</p>
        <div className={styles.apiRow}>
          <span className={styles.cardSub}>{t('partner.validate.apiEndpoint')}</span>
          <code className={styles.mono}>POST {data.api.baseUrl}</code>
        </div>
        <div className={styles.apiRow}>
          <span className={styles.cardSub}>{t('partner.validate.apiKey')}</span>
          <code className={styles.mono}>{data.api.key}</code>
        </div>
      </Surface>
    </>
  )
}
