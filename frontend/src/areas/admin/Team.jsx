import styles from './admin.module.css'
import { Surface, Stat, SectionTitle, Badge, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, SECTIONS, ADMIN_ROLES } from './adminSession.js'

export function Team() {
  const t = useT()
  useDocumentTitle(t('admin.team.title'))
  const state = useAdminData(() => adminApi.get('/admin/me'))
  const data = state.data

  return (
    <>
      <h1 className={styles.title}>{t('admin.team.title')}</h1>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <Surface className={styles.stack}>
            <p className={styles.cellMeta}>{t('admin.team.intro')}</p>
            <div className={styles.statsRow}>
              <Stat value={data.team.moderators} label={t('admin.team.moderators')} />
              <Stat value={data.team.support} label={t('admin.team.support')} />
              <Stat value={data.team.commercial} label={t('admin.team.commercial')} />
              <Stat value={data.team.sre} label={t('admin.team.sre')} />
            </div>
            <span className={styles.cellMeta}>{t('admin.team.reviewedAt', { when: fmtRelative(data.team.reviewedAt) })}</span>
          </Surface>
          <Surface className={styles.stack}>
            <SectionTitle as="h2">{t('admin.team.roles')}</SectionTitle>
            <p className={styles.cellMeta}>{t('admin.team.rolesIntro')}</p>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableNarrow}`}>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.header.role')}</th>
                    <th scope="col">{t('admin.nav.label')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ADMIN_ROLES.map((role) => (
                    <tr key={role}>
                      <th scope="row">
                        {t(`admin.roles.${role}`)} {data.user.role === role ? <Badge tone="brand">{data.user.name}</Badge> : null}
                      </th>
                      <td>
                        <div className={styles.chips}>
                          {SECTIONS.filter((s) => s.roles.includes(role)).map((s) => (
                            <Badge key={s.key} tone="neutral">
                              <Icon name={s.icon} size={12} /> {t(`admin.nav.${s.key}`)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        </>
      ) : null}
    </>
  )
}
