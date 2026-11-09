import { useState } from 'react'
import { partnerApi } from '../../lib/api.js'
import { Button, Chip, Badge, Sheet, Input, Textarea, Stepper, ScreenHeader, useToast } from '../../design-system/index.js'
import { Meter, PanelEmpty, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { fmtNumber } from '../../lib/format.js'
import styles from './partner.module.css'

const EMPTY_FORM = { title: '', description: '', costNeurons: 30, stock: 50, validityDays: 30, terms: '' }

export function PartnerCampaigns({ data, onChange }) {
  const t = useT()
  const toast = useToast()
  const { campaigns } = data
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [restocking, setRestocking] = useState(null)
  const [restockValue, setRestockValue] = useState(0)
  const [busy, setBusy] = useState(null)

  function updateCampaign(updated) {
    onChange((prev) => ({ ...prev, campaigns: prev.campaigns.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)) }))
  }

  async function create(e) {
    e.preventDefault()
    const next = {}
    if (!form.title.trim()) next.title = t('partner.campaigns.form.errorTitle')
    if (!(form.costNeurons > 0)) next.costNeurons = t('partner.campaigns.form.errorCost')
    if (!(form.stock > 0)) next.stock = t('partner.campaigns.form.errorStock')
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const res = await partnerApi.post('/partner/campaigns', { ...form, costNeurons: Number(form.costNeurons), stock: Number(form.stock), validityDays: Number(form.validityDays) })
      onChange((prev) => ({ ...prev, campaigns: [{ ...res.campaign, redemptions: 0, used: 0 }, ...prev.campaigns] }))
      toast.show({ message: t('partner.campaigns.form.created'), icon: 'check' })
      setCreating(false)
      setForm(EMPTY_FORM)
    } catch {
      toast.show({ message: t('partner.campaigns.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setSaving(false)
    }
  }

  async function saveRestock(e) {
    e.preventDefault()
    if (!restocking) return
    setBusy(restocking.id)
    try {
      const res = await partnerApi.patch(`/partner/campaigns/${restocking.id}`, { stock: restockValue })
      updateCampaign(res.campaign)
      toast.show({ message: t('partner.campaigns.restocked'), icon: 'check' })
      setRestocking(null)
    } catch {
      toast.show({ message: t('partner.campaigns.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setBusy(null)
    }
  }

  async function togglePause(campaign) {
    setBusy(campaign.id)
    try {
      const res = await partnerApi.patch(`/partner/campaigns/${campaign.id}`, { paused: !campaign.paused })
      updateCampaign(res.campaign)
    } catch {
      toast.show({ message: t('partner.campaigns.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <ScreenHeader
        size="compact"
        eyebrow={t('partner.shell.groups.operation')}
        title={t('partner.campaigns.title')}
        lead={t('partner.pages.campaignsLead')}
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            {t('partner.campaigns.new')}
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <PanelEmpty icon="gift" title={t('partner.campaigns.empty')} text={t('partner.campaigns.emptyText')} />
      ) : (
        <div className={styles.campaignGrid}>
          {campaigns.map((c) => {
            const soldOut = c.stock <= 0
            const lastUnits = c.stock > 0 && c.stock <= 3
            const usePct = c.redemptions ? Math.round((c.used / c.redemptions) * 100) : 0
            return (
              <article key={c.id} className={panelStyles.card} data-tone={c.paused ? 'muted' : soldOut ? 'danger' : lastUnits ? 'warning' : undefined}>
                <div className={styles.campaign}>
                  <div className={styles.campaignHead}>
                    <div>
                      <h2 className={styles.campaignTitle}>{c.title}</h2>
                      <p className={styles.campaignDesc}>{c.description}</p>
                    </div>
                    {c.paused ? (
                      <Badge tone="neutral" icon="pause">
                        {t('partner.campaigns.paused')}
                      </Badge>
                    ) : soldOut ? (
                      <Badge tone="danger">{t('partner.campaigns.soldOut')}</Badge>
                    ) : lastUnits ? (
                      <Badge tone="warning">{t('partner.campaigns.lastUnits')}</Badge>
                    ) : null}
                  </div>
                  <div className={styles.chips}>
                    <Chip tone="reward" icon="neuron">
                      {t('partner.campaigns.cost', { count: c.costNeurons })}
                    </Chip>
                    <Chip tone="neutral" icon="clock">
                      {t('partner.campaigns.validity', { days: c.validityDays })}
                    </Chip>
                    {c.positioning ? (
                      <Chip tone="brand" icon="star">
                        {t(`partner.campaigns.positioning.${c.positioning}`)}
                      </Chip>
                    ) : null}
                  </div>
                  <dl className={styles.campaignStats}>
                    <div>
                      <dt>{t('partner.campaigns.stock')}</dt>
                      <dd data-tone={soldOut ? 'danger' : lastUnits ? 'warning' : undefined}>{fmtNumber(c.stock)}</dd>
                    </div>
                    <div>
                      <dt>{t('partner.campaigns.redemptions')}</dt>
                      <dd>{fmtNumber(c.redemptions)}</dd>
                    </div>
                    <div>
                      <dt>{t('partner.campaigns.used')}</dt>
                      <dd>{fmtNumber(c.used)}</dd>
                    </div>
                  </dl>
                  <div className={styles.useRow}>
                    <Meter value={usePct} tone="success" label={t('partner.pages.useRate', { pct: usePct })} />
                    <span>{t('partner.pages.usedOfRedeemed', { used: fmtNumber(c.used), redeemed: fmtNumber(c.redemptions) })}</span>
                  </div>
                  <div className={styles.campaignActions}>
                    <Button
                      variant="soft"
                      size="small"
                      icon="upload"
                      onClick={() => {
                        setRestocking(c)
                        setRestockValue(Math.max(c.stock, 1))
                      }}
                    >
                      {t('partner.campaigns.restock')}
                    </Button>
                    <Button variant="ghost" size="small" icon={c.paused ? 'play' : 'pause'} onClick={() => togglePause(c)} loading={busy === c.id}>
                      {c.paused ? t('partner.campaigns.resume') : t('partner.campaigns.pause')}
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title={t('partner.campaigns.form.title')}
        footer={
          <Button type="submit" form="campaign-form" loading={saving}>
            {t('partner.campaigns.form.submit')}
          </Button>
        }
      >
        <form id="campaign-form" className={styles.validateForm} onSubmit={create} noValidate>
          <Input id="campaign-title" label={t('partner.campaigns.form.name')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
          <Textarea id="campaign-description" label={t('partner.campaigns.form.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} optional rows={3} />
          <Input id="campaign-cost" type="number" min={1} inputMode="numeric" label={t('partner.campaigns.form.cost')} hint={t('partner.campaigns.form.hintCost')} value={form.costNeurons} onChange={(e) => setForm({ ...form, costNeurons: Number(e.target.value) })} error={errors.costNeurons} />
          <Input id="campaign-stock" type="number" min={1} inputMode="numeric" label={t('partner.campaigns.form.stock')} hint={t('partner.campaigns.form.hintStock')} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} error={errors.stock} />
          <Input id="campaign-validity" type="number" min={1} max={365} inputMode="numeric" label={t('partner.campaigns.form.validity')} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
          <Textarea id="campaign-terms" label={t('partner.campaigns.form.terms')} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} optional rows={2} />
        </form>
      </Sheet>

      <Sheet
        open={Boolean(restocking)}
        onClose={() => setRestocking(null)}
        title={restocking ? t('partner.campaigns.restockTitle', { title: restocking.title }) : ''}
        footer={
          <Button type="submit" form="restock-form" loading={Boolean(busy)}>
            {t('partner.campaigns.restockSave')}
          </Button>
        }
      >
        <form id="restock-form" className={styles.validateForm} onSubmit={saveRestock}>
          <p className={styles.cardSub}>{t('partner.campaigns.restockLabel')}</p>
          <Stepper value={restockValue} onChange={setRestockValue} min={0} max={100000} step={10} label={t('partner.campaigns.restockLabel')} />
        </form>
      </Sheet>
    </>
  )
}
