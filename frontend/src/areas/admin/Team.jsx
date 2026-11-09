import styles from './admin.module.css'
import { Badge, Icon, Panel, ScreenHeader, StatTile } from '../../design-system/index.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { panelStyles } from '../shared/PanelShell.jsx'
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
  const eyebrow = useSectionEyebrow('equipe')

  return (
    <>
      <ScreenHeader size="compact" eyebrow={eyebrow} title={t('admin.team.title')} lead={t('admin.pages.team.lead')} />
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <div className={panelStyles.kpis}>
            <StatTile size="compact" icon="shield" label={t('admin.team.moderators')} value={data.team.moderators} />
            <StatTile size="compact" icon="help" label={t('admin.team.support')} value={data.team.support} />
            <StatTile size="compact" icon="building" label={t('admin.team.commercial')} value={data.team.commercial} />
            <StatTile size="compact" icon="zap" label={t('admin.team.sre')} value={data.team.sre} />
          </div>
          <p className={styles.cellMeta}>
            {t('admin.team.intro')} {t('admin.team.reviewedAt', { when: fmtRelative(data.team.reviewedAt) })}
          </p>
          <Panel tone="quiet" title={t('admin.team.roles')} icon="key" labelledBy="roles-title" bodyClassName={styles.panelFlush}>
            <p className={styles.cellMeta} style={{ padding: '14px 18px 0' }}>
              {t('admin.team.rolesIntro')}
            </p>
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
          </Panel>
        </>
      ) : null}
    </>
  )
}
