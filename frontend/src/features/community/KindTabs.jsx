import { useRef } from 'react'
import styles from './community.module.css'
import { Icon } from '../../design-system/index.js'

export function KindTabs({ tabs, value, onChange, label, idBase, orientation = 'horizontal' }) {
  const refs = useRef({})
  const move = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    onChange(tab.value)
    refs.current[tab.value]?.focus()
  }
  const onKeyDown = (e, index) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(index + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(index - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(tabs.length - 1)
    else return
    e.preventDefault()
  }
  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={orientation === 'vertical' ? styles.kindTabsVertical : styles.kindTabs}>
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
            className={styles.kindTab}
            data-kind={tab.value}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.icon ? <Icon name={tab.icon} size={18} /> : null}
            <span className={styles.kindTabLabel}>{tab.label}</span>
            {tab.count !== undefined ? <span className={styles.kindTabCount}>{tab.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
