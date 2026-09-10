import { Outlet } from 'react-router-dom'
import styles from './auth.module.css'
import { Icon, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

export function AuthLayout() {
  const t = useT()
  const aside = t('auth.aside')
  return (
    <div className={styles.layout}>
      <aside className={styles.aside}>
        <Wordmark size={28} />
        <h1 className={styles.asideTitle}>{t('auth.tagline')}</h1>
        <ul className={styles.asideList}>
          {Array.isArray(aside)
            ? aside.map((line, i) => (
                <li key={i}>
                  <Icon name={['sparkle', 'book', 'neuron'][i]} size={20} /> {line}
                </li>
              ))
            : null}
        </ul>
      </aside>
      <main className={styles.card} id="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
