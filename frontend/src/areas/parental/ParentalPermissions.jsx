import { useState } from 'react'
import { parentalApi } from '../../lib/api.js'
import { Surface, Toggle, Button, Banner, Input, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import styles from './parental.module.css'

const KEYS = ['community', 'publicLink', 'externalMembers', 'schoolShare', 'whatsappInfo']

export function ParentalPermissions({ data, onChange }) {
  const t = useT()
  const toast = useToast()
  const { permissions, permissionLabels } = data
  const [busy, setBusy] = useState(null)
  const [window, setWindow] = useState({ start: permissions.notificationWindow?.start || '21:00', end: permissions.notificationWindow?.end || '07:00' })
  const [savingWindow, setSavingWindow] = useState(false)

  async function toggle(key, value) {
    const previous = permissions[key]
    onChange({ permissions: { ...permissions, [key]: value } })
    setBusy(key)
    try {
      const res = await parentalApi.patch('/parental/permissions', { [key]: value })
      onChange({ permissions: res.permissions, requests: res.requests })
      toast.show({ message: t('parental.permissions.saved'), icon: 'check' })
    } catch {
      onChange({ permissions: { ...permissions, [key]: previous } })
      toast.show({ message: t('parental.permissions.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setBusy(null)
    }
  }

  async function saveWindow(e) {
    e.preventDefault()
    setSavingWindow(true)
    try {
      const res = await parentalApi.patch('/parental/permissions', { notificationWindow: window })
      onChange({ permissions: res.permissions })
      toast.show({ message: t('parental.permissions.windowSaved'), icon: 'check' })
    } catch {
      toast.show({ message: t('parental.permissions.error'), tone: 'danger', icon: 'alert' })
    } finally {
      setSavingWindow(false)
    }
  }

  return (
    <>
      <div>
        <h1 className={styles.pageTitle}>{t('parental.permissions.title')}</h1>
        <p className={styles.pageIntro}>{t('parental.permissions.intro')}</p>
      </div>

      <Surface>
        <div className={styles.permissionList}>
          {KEYS.map((key) => (
            <div key={key} className={styles.permissionItem}>
              <Toggle checked={Boolean(permissions[key])} onChange={(v) => toggle(key, v)} label={permissionLabels[key]?.label || key} help={permissionLabels[key]?.help} disabled={busy === key} />
            </div>
          ))}
        </div>
      </Surface>

      <Surface as="form" onSubmit={saveWindow}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>{permissionLabels.notificationWindow?.label || t('parental.permissions.windowTitle')}</h2>
            <p className={styles.cardSub}>{permissionLabels.notificationWindow?.help || t('parental.permissions.windowHelp')}</p>
          </div>
        </div>
        <div className={styles.windowFields}>
          <Input id="window-start" type="time" label={t('parental.permissions.start')} value={window.start} onChange={(e) => setWindow((w) => ({ ...w, start: e.target.value }))} />
          <Input id="window-end" type="time" label={t('parental.permissions.end')} value={window.end} onChange={(e) => setWindow((w) => ({ ...w, end: e.target.value }))} />
        </div>
        <div className={styles.actions}>
          <Button type="submit" variant="soft" icon="check" loading={savingWindow}>
            {t('parental.permissions.saveWindow')}
          </Button>
        </div>
      </Surface>

      <div className={styles.notes}>
        <Banner tone="neutral" icon="lock">
          {t('parental.permissions.toneNote')}
        </Banner>
        <Banner tone="brand" icon="neuron">
          {t('parental.permissions.gamificationNote')}
        </Banner>
      </div>
    </>
  )
}
