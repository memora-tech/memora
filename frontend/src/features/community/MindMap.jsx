import { useId, useMemo, useState } from 'react'
import styles from './community.module.css'
import { Button, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

function collectParents(node, out = []) {
  if (node.children?.length) {
    out.push(node.id)
    node.children.forEach((c) => collectParents(c, out))
  }
  return out
}

function countNodes(node) {
  return 1 + (node.children || []).reduce((n, c) => n + countNodes(c), 0)
}

function MapNode({ node, open, toggle, idBase }) {
  const hasChildren = node.children?.length > 0
  const isOpen = open.has(node.id)
  const listId = `${idBase}-${node.id}`
  return (
    <li className={styles.mapNode}>
      {hasChildren ? (
        <button type="button" className={styles.mapToggle} aria-expanded={isOpen ? 'true' : 'false'} aria-controls={listId} onClick={() => toggle(node.id)}>
          <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} />
          <span className={styles.mapLabel}>{node.label}</span>
          <span className={styles.mapCount}>{node.children.length}</span>
        </button>
      ) : (
        <span className={styles.mapLeaf}>
          <span className={styles.mapLabel}>{node.label}</span>
        </span>
      )}
      {node.note ? <span className={styles.mapNote}>{node.note}</span> : null}
      {hasChildren ? (
        <ul id={listId} className={styles.mapChildren} hidden={!isOpen}>
          {node.children.map((c) => (
            <MapNode key={c.id} node={c} open={open} toggle={toggle} idBase={idBase} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function MindMap({ root }) {
  const t = useT()
  const idBase = useId().replace(/:/g, '')
  const total = useMemo(() => countNodes(root), [root])
  const parents = useMemo(() => collectParents(root).filter((id) => id !== root.id), [root])
  const [open, setOpen] = useState(() => new Set(total <= 40 ? parents : root.children.map((c) => c.id)))
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOpen = parents.every((id) => open.has(id))

  return (
    <section className={styles.mindmap} aria-labelledby={`${idBase}-root`}>
      <div className={styles.mapToolbar}>
        <p className={styles.meta}>{t('community.mindmap.outline', { root: root.label, branches: root.children.length, nodes: total })}</p>
        {parents.length ? (
          <Button size="small" variant="ghost" icon={allOpen ? 'chevronUp' : 'chevronDown'} onClick={() => setOpen(new Set(allOpen ? [] : parents))}>
            {allOpen ? t('community.mindmap.collapseAll') : t('community.mindmap.expandAll')}
          </Button>
        ) : null}
      </div>
      <h2 id={`${idBase}-root`} className={styles.mapRoot}>
        <Icon name="mindmap" size={20} />
        {root.label}
      </h2>
      <ol className={styles.mapBranches}>
        {root.children.map((branch, i) => (
          <li key={branch.id} className={styles.mapBranch} data-branch={i % 5}>
            <span className={styles.mapBranchIndex}>{t('community.mindmap.branch', { n: i + 1 })}</span>
            <ul className={styles.mapTree}>
              <MapNode node={branch} open={open} toggle={toggle} idBase={idBase} />
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}
