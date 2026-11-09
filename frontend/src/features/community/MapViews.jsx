import { useMemo } from 'react'
import styles from './mapviews.module.css'
import { Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

const COL = 210
const ROW = 40
const NODE_H = 30
const PAD = 16

function clip(text = '', n) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

function layoutTree(root) {
  const nodes = []
  const edges = []
  let leaf = 0
  const walk = (node, depth, branch) => {
    let y
    if (!node.children?.length) {
      y = leaf * ROW
      leaf += 1
    } else {
      const ys = node.children.map((c, i) => walk(c, depth + 1, depth === 0 ? i % 5 : branch))
      y = (ys[0] + ys[ys.length - 1]) / 2
      node.children.forEach((c, i) => edges.push({ from: { depth, y }, to: { depth: depth + 1, y: ys[i] }, branch: depth === 0 ? i % 5 : branch }))
    }
    nodes.push({ id: node.id, label: node.label, depth, y, branch, leaf: !node.children?.length })
    return y
  }
  walk(root, 0, -1)
  const depth = Math.max(...nodes.map((n) => n.depth))
  return { nodes, edges, width: (depth + 1) * COL + PAD * 2, height: Math.max(leaf, 1) * ROW + PAD * 2 }
}

export function MapCanvas({ root }) {
  const t = useT()
  const { nodes, edges, width, height } = useMemo(() => layoutTree(root), [root])
  const nodeW = COL - 34
  return (
    <figure className={styles.canvasWrap}>
      <div className={styles.canvasScroll}>
        <svg className={styles.canvas} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
          <g transform={`translate(${PAD} ${PAD})`}>
            {edges.map((e, i) => {
              const x1 = e.from.depth * COL + nodeW
              const y1 = e.from.y + NODE_H / 2
              const x2 = e.to.depth * COL
              const y2 = e.to.y + NODE_H / 2
              const mx = (x1 + x2) / 2
              return <path key={i} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} className={styles.edge} data-branch={e.branch} />
            })}
            {nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.depth * COL} ${n.y})`} className={styles.node} data-depth={Math.min(n.depth, 2)} data-branch={n.branch}>
                <rect width={nodeW} height={NODE_H} rx={n.depth === 0 ? 15 : 9} />
                <text x={12} y={NODE_H / 2 + 4.5}>
                  {clip(n.label, n.depth === 0 ? 22 : 26)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <figcaption className={styles.caption}>
        <Icon name="info" size={14} /> {t('community.mapviews.canvasHint')}
      </figcaption>
    </figure>
  )
}

function Sub({ node }) {
  return (
    <li className={styles.sub}>
      <span className={styles.subLabel}>{node.label}</span>
      {node.note ? <span className={styles.subNote}>{node.note}</span> : null}
      {node.children?.length ? (
        <ul className={styles.subList}>
          {node.children.map((c) => (
            <Sub key={c.id} node={c} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function MapDiagram({ root }) {
  const t = useT()
  return (
    <section className={styles.diagram} aria-labelledby="diagram-root">
      <h2 id="diagram-root" className={styles.diagramRoot}>
        <Icon name="route" size={18} />
        {root.label}
      </h2>
      <ol className={styles.stages}>
        {root.children.map((stage, i) => (
          <li key={stage.id} className={styles.stage} data-branch={i % 5}>
            <span className={styles.stageNum} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.stageHead}>
              <span className="sr-only">{t('community.mapviews.stage', { n: i + 1 })}: </span>
              {stage.label}
            </span>
            {stage.note ? <span className={styles.stageNote}>{stage.note}</span> : null}
            {stage.children?.length ? (
              <ul className={styles.subList}>
                {stage.children.map((c) => (
                  <Sub key={c.id} node={c} />
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
