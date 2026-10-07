import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './proto.module.css'
import { Button, ConfirmDialog, Icon, Segmented, Sheet, Toggle, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useProto } from '../../state/ProtoContext.jsx'
import { useStudy } from '../../state/StudyContext.jsx'
import { SimulateButton } from '../mcp/SimulateButton.jsx'

export function ProtoBar() {
  const t = useT()
  const toast = useToast()
  const proto = useProto()
  const study = useStudy()
  const location = useLocation()
  const [resetOpen, setResetOpen] = useState(false)
  const [force, setForce] = useState(false)
  const inSession = location.pathname === '/app/estudar' && study.focus

  useEffect(() => {
    if (proto.barOpen) proto.refreshServer()
  }, [proto.barOpen])

  const server = proto.server
  const couponAvailable = server ? server.couponAvailable : true

  return (
    <>
      <button type="button" className={[styles.fab, inSession && styles.fabQuiet].filter(Boolean).join(' ')} onClick={() => proto.setBarOpen(true)} aria-label={t('proto.open')} aria-haspopup="dialog">
        <Icon name="settings" size={18} />
        <span className={styles.fabLabel}>{t('proto.open')}</span>
      </button>
      <Sheet open={proto.barOpen} onClose={() => proto.setBarOpen(false)} title={t('proto.title')}>
        <p className={styles.meta}>{t('proto.intro')}</p>
        {server ? <p className={styles.meta}>{t('proto.stateLine', { profile: t(`proto.profiles.${server.profile}`), balance: server.balance, used: server.quota?.used ?? 0, intensity: server.intensity })}</p> : null}

        <div className={styles.block}>
          <span className={styles.label}>{t('proto.profile')}</span>
          <Segmented
            label={t('proto.profile')}
            value={server?.profile || 'adult-free'}
            onChange={async (p) => {
              await proto.setProfile(p)
              toast.show({ message: t(`proto.profiles.${p}`), icon: 'user' })
            }}
            options={['adult-free', 'adult-premium', 'minor'].map((p) => ({ value: p, label: t(`proto.profiles.${p}`) }))}
          />
        </div>

        <Toggle checked={Boolean(couponAvailable)} onChange={(v) => proto.setCouponAvailable(v)} label={t('proto.coupon')} help={t('proto.couponHelp')} />
        <Toggle checked={proto.offline} onChange={(v) => proto.setOffline(v)} label={t('proto.offline')} help={t('proto.offlineHelp')} />

        <div className={styles.block}>
          <span className={styles.label}>{t('proto.notification')}</span>
          <div className={styles.row}>
            <Button size="small" variant="soft" icon="bell" onClick={() => proto.triggerNotification('push', force).then(() => proto.setBarOpen(false))}>
              {t('proto.push')}
            </Button>
            <Button size="small" variant="soft" icon="message" onClick={() => proto.triggerNotification('whatsapp', force).then(() => proto.setBarOpen(false))}>
              {t('proto.whatsapp')}
            </Button>
          </div>
          <Toggle checked={force} onChange={setForce} label={t('proto.force')} help={t('proto.forceHelp')} />
          <span className={styles.meta}>{t('proto.notificationHelp')}</span>
        </div>

        <div className={styles.block}>
          <span className={styles.label}>{t('proto.fatigue')}</span>
          <Button
            size="small"
            variant="soft"
            icon="clock"
            disabled={!study.active}
            onClick={() => {
              proto.simulateFatigue()
              proto.setBarOpen(false)
            }}
          >
            {t('proto.fatigue')}
          </Button>
          <span className={styles.meta}>{study.active ? t('proto.fatigueHelp') : t('proto.fatigueNeedsSession')}</span>
        </div>

        <div className={styles.block}>
          <span className={styles.label}>{t('proto.nextGeneration')}</span>
          <Segmented label={t('proto.nextGeneration')} value={proto.nextGeneration} onChange={proto.setNextGeneration} options={['normal', 'fail', 'big'].map((g) => ({ value: g, label: t(`proto.generations.${g}`) }))} />
        </div>

        <div className={styles.block}>
          <span className={styles.label}>{t('proto.mcp')}</span>
          <SimulateButton size="small" onDone={() => proto.setBarOpen(false)} />
          <span className={styles.meta}>{t('mcp.arrival.simulateHint')}</span>
        </div>

        <div className={styles.block}>
          <span className={styles.label}>{t('auth.panels.title')}</span>
          <div className={styles.row}>
            {[
              { to: '/parental', key: 'parental', icon: 'users' },
              { to: '/b2b', key: 'b2b', icon: 'school' },
              { to: '/admin', key: 'admin', icon: 'shield' },
              { to: '/parceiro', key: 'partner', icon: 'gift' }
            ].map((p) => (
              <Button key={p.key} size="small" variant="ghost" icon={p.icon} to={p.to} onClick={() => proto.setBarOpen(false)}>
                {t(`auth.panels.${p.key}`)}
              </Button>
            ))}
          </div>
          <span className={styles.meta}>{t('proto.panelsHelp')}</span>
        </div>

        <Button variant="danger" icon="refresh" onClick={() => setResetOpen(true)}>
          {t('proto.reset')}
        </Button>
      </Sheet>
      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={proto.reset} title={t('proto.resetTitle')} confirmLabel={t('proto.reset')} danger>
        <p>{t('proto.resetText')}</p>
      </ConfirmDialog>
    </>
  )
}
