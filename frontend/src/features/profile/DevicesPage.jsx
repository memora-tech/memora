import { useState } from 'react'
import styles from './profile.module.css'
import { Badge, Banner, Button, Icon, Input, PageHeader, Sheet, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate, fmtRelative } from '../../lib/format.js'

export function DevicesPage() {
  const t = useT()
  const toast = useToast()
  const sessions = useAsync(() => studentApi.get('/me/sessions'), [])
  const [pwOpen, setPwOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('profile.devices.title'))

  const end = async (id) => {
    try {
      await studentApi.del(`/me/sessions/${id}`)
      toast.show({ message: t('profile.devices.ended'), icon: 'check' })
      sessions.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const endAll = async () => {
    try {
      await studentApi.del('/me/sessions')
      toast.show({ message: t('profile.devices.endedAll'), icon: 'check' })
      sessions.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const changePassword = async () => {
    setBusy(true)
    try {
      await studentApi.post('/me/password', { current, next })
      toast.show({ message: t('profile.devices.passwordChanged'), icon: 'check', duration: 6000 })
      setPwOpen(false)
      setCurrent('')
      setNext('')
      sessions.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const list = sessions.data?.sessions || []

  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.devices.title')} backTo="/app/perfil" backLabel={t('profile.title')} actions={<Button size="small" variant="ghost" icon="key" label={t('profile.devices.changePassword')} onClick={() => setPwOpen(true)} />}>
        {t('profile.devices.policy')}
      </PageHeader>

      {sessions.loading && !sessions.data ? <Skeleton height={64} count={3} /> : null}
      {sessions.error && !sessions.data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => sessions.run()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {list.length ? (
        <Surface>
          {list.map((s) => (
          <div key={s.id} className={styles.row}>
            <Icon name="device" size={22} />
            <div className={styles.rowBody}>
              <span className={styles.rowTitle}>
                {s.device} {s.current ? <Badge tone="brand">{t('profile.devices.current')}</Badge> : null}
              </span>
              <span className={styles.meta}>
                {s.location} · {t('profile.devices.lastUsed', { when: fmtRelative(s.lastUsedAt) })} · {t('profile.devices.since', { date: fmtDate(s.createdAt) })}
              </span>
            </div>
              {!s.current ? (
                <Button size="small" variant="ghost" onClick={() => end(s.id)}>
                  {t('profile.devices.end')}
                </Button>
              ) : null}
            </div>
          ))}
        </Surface>
      ) : null}
      {list.filter((s) => !s.current).length ? (
        <Button variant="danger" icon="logout" onClick={endAll}>
          {t('profile.devices.endAll')}
        </Button>
      ) : null}

      <Sheet
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={t('profile.devices.changePassword')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button loading={busy} disabled={!current || next.length < 8} onClick={changePassword}>
              {t('common.actions.save')}
            </Button>
          </>
        }
      >
        <Input label={t('profile.devices.currentPassword')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label={t('profile.devices.newPassword')} type="password" autoComplete="new-password" hint={t('profile.devices.passwordHint')} value={next} onChange={(e) => setNext(e.target.value)} />
      </Sheet>
    </div>
  )
}
