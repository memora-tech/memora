import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ds.module.css'
import { Button } from './Button.jsx'
import { useT } from '../i18n/index.js'

export function PageHeader({ title, back = true, backTo, onBack, actions, children }) {
  const t = useT()
  const navigate = useNavigate()
  const ref = useRef(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    node.parentNode.insertBefore(sentinel, node)
    const observer = new IntersectionObserver((entries) => setStuck(!entries[0].isIntersecting), { threshold: 1 })
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
      sentinel.remove()
    }
  }, [])

  const goBack = () => {
    if (onBack) onBack()
    else if (backTo) navigate(backTo)
    else navigate(-1)
  }

  return (
    <>
      <div ref={ref} className={[styles.pageHeader, stuck && styles.pageHeaderStuck].filter(Boolean).join(' ')}>
        {back ? <Button variant="text" icon="arrowLeft" label={t('common.actions.back')} onClick={goBack} /> : <span />}
        <span className={styles.pageHeaderTitle}>{stuck ? title : ''}</span>
        <span className={styles.pageHeaderActions}>{actions}</span>
      </div>
      <div className={styles.pageTitleBlock}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {children ? <p className={styles.pageLead}>{children}</p> : null}
      </div>
    </>
  )
}
