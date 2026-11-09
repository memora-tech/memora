import { useState } from 'react'
import { parentalApi } from '../../lib/api.js'
import { Panel, ScreenHeader, Toggle, Button, Input, Icon, useToast } from '../../design-system/index.js'
import { Trend, panelStyles } from '../shared/PanelShell.jsx'
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
      <ScreenHeader size="compact" eyebrow={t('parental.shell.groups.control')} title={t('parental.permissions.title')} lead={t('parental.pages.permissionsLead')} />

      <div className={panelStyles.split}>
        <Panel tone="quiet" title={t('parental.permissions.title')} icon="shield" labelledBy="perm-title" action={<Trend tone="brand">{t('parental.pages.enabled', { count: KEYS.filter((k) => permissions[k]).length })}</Trend>}>
          <div className={styles.permissionList}>
            {KEYS.map((key) => (
              <div key={key} className={styles.permissionItem} data-on={permissions[key] ? 'true' : 'false'}>
                <Toggle checked={Boolean(permissions[key])} onChange={(v) => toggle(key, v)} label={permissionLabels[key]?.label || key} help={permissionLabels[key]?.help} disabled={busy === key} />
              </div>
            ))}
          </div>
        </Panel>

        <div className={panelStyles.stack}>
          <Panel tone="quiet" title={permissionLabels.notificationWindow?.label || t('parental.permissions.windowTitle')} icon="clock" labelledBy="window-title">
            <p className={styles.cardSub}>{permissionLabels.notificationWindow?.help || t('parental.permissions.windowHelp')}</p>
            <div className={styles.windowFields}>
              <Input id="window-start" type="time" label={t('parental.permissions.start')} value={window.start} onChange={(e) => setWindow((w) => ({ ...w, start: e.target.value }))} />
              <Input id="window-end" type="time" label={t('parental.permissions.end')} value={window.end} onChange={(e) => setWindow((w) => ({ ...w, end: e.target.value }))} />
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="soft" icon="check" loading={savingWindow} onClick={saveWindow}>
                {t('parental.permissions.saveWindow')}
              </Button>
            </div>
          </Panel>
          <p className={panelStyles.callout}>
            <Icon name="lock" size={18} />
            <span>{t('parental.permissions.toneNote')}</span>
          </p>
          <p className={panelStyles.callout}>
            <Icon name="neuron" size={18} />
            <span>{t('parental.permissions.gamificationNote')}</span>
          </p>
        </div>
      </div>
    </>
  )
}
