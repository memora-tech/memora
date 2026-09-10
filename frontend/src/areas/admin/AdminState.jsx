import styles from './admin.module.css'
import { Button, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

export function AdminState({ loading, error, onRetry }) {
  const t = useT()
  if (loading) {
    return (
      <div className={styles.stateBox} role="status">
        <Icon name="refresh" size={28} />
        <span>{t('admin.common.loading')}</span>
      </div>
    )
  }
  if (error) {
    const message = error.status === 403 ? t('admin.common.forbidden') : error.code === 'offline' ? t('admin.common.offline') : error.message || t('admin.common.error')
    return (
      <div className={styles.stateBox} role="alert">
        <Icon name="alert" size={28} />
        <span>{message}</span>
        {onRetry ? (
          <Button variant="ghost" icon="refresh" onClick={onRetry}>
            {t('admin.common.retry')}
          </Button>
        ) : null}
      </div>
    )
  }
  return null
}
