import { useRef } from 'react'
import styles from './screen.module.css'
import { Icon } from './Icon.jsx'

export function TabBar({ tabs, value, onChange, label, idBase }) {
  const refs = useRef({})
  const move = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    onChange(tab.value)
    refs.current[tab.value]?.focus()
  }
  const onKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') move(index + 1)
    else if (e.key === 'ArrowLeft') move(index - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(tabs.length - 1)
    else return
    e.preventDefault()
  }
  return (
    <div role="tablist" aria-label={label} className={styles.tabBar}>
      {tabs.map((tab, i) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[tab.value] = el
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${tab.value}`}
            aria-selected={selected ? 'true' : 'false'}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            className={styles.tabBarTab}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.icon ? <Icon name={tab.icon} size={18} /> : null}
            {tab.label}
            {tab.count !== undefined ? <span className={styles.tabBarCount}>{tab.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ idBase, value, children, className }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className={[styles.tabPanel, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
