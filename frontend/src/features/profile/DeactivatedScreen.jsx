import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './profile.module.css'
import { Button, EmptyState, Surface, Wordmark, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { studentApi } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'

export function DeactivatedScreen() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const purgeAt = session.user?.deactivatedAt ? new Date(new Date(session.user.deactivatedAt).getTime() + 30 * 86400000).toISOString() : null

  const reactivate = async () => {
    setBusy(true)
    try {
      await studentApi.post('/privacy/reactivate')
      toast.show({ message: t('profile.privacy.reactivated'), icon: 'check' })
      await session.refresh()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Surface className={styles.page} style={{ maxWidth: 480, width: '100%' }}>
        <Wordmark size={22} />
        <EmptyState
          icon="lock"
          title={t('profile.deactivated.title')}
          text={t('profile.deactivated.text', { date: fmtDate(purgeAt) })}
          action={
            <div className={styles.actions} style={{ justifyContent: 'center' }}>
              <Button icon="refresh" loading={busy} onClick={reactivate}>
                {t('profile.deactivated.reactivate')}
              </Button>
              <Button
                variant="ghost"
                icon="logout"
                onClick={async () => {
                  await session.logout()
                  navigate('/entrar', { replace: true })
                }}
              >
                {t('profile.deactivated.logout')}
              </Button>
            </div>
          }
        />
      </Surface>
    </div>
  )
}
