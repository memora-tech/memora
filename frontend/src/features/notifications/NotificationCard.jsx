import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../../areas/student/student.module.css'
import { Button, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useProto } from '../../state/ProtoContext.jsx'

export function NotificationCard() {
  const t = useT()
  const proto = useProto()
  const navigate = useNavigate()
  const n = proto.notification

  useEffect(() => {
    if (!n || n.undelivered) return undefined
    const timer = setTimeout(() => proto.dismissNotification(), 12000)
    return () => clearTimeout(timer)
  }, [n, proto])

  if (!n || n.undelivered) return null

  const whatsapp = n.channel === 'whatsapp'
  return (
    <div className={styles.notif} role="status" aria-live="polite">
      <span className={[styles.notifIcon, whatsapp && styles.notifIconWhatsapp].filter(Boolean).join(' ')}>
        <Icon name={whatsapp ? 'message' : 'bell'} size={20} />
      </span>
      <div className={styles.notifBody}>
        <span className={styles.notifMeta}>
          {t(`common.notification.channel.${n.channel}`)} · {t(`common.intensity.${n.intensity}`)}
        </span>
        <span className={styles.notifTitle}>{n.title}</span>
        <span className={styles.notifText}>{n.body}</span>
        <div className={styles.notifActions}>
          <Button
            size="small"
            onClick={() => {
              proto.dismissNotification()
              navigate(n.deepLink || '/app')
            }}
          >
            {t('common.notification.open')}
          </Button>
          <Button size="small" variant="text" onClick={proto.dismissNotification}>
            {t('common.notification.dismiss')}
          </Button>
        </div>
      </div>
    </div>
  )
}
