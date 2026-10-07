import styles from './community.module.css'

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

function safeHref(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

function inline(text, keyBase) {
  return String(text)
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part, i) => {
      const key = `${keyBase}-${i}`
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (link) {
        const href = safeHref(link[2])
        return href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>
        ) : (
          link[1]
        )
      }
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>
      return part
    })
}

function parse(markdown) {
  const blocks = []
  let list = null
  let para = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }
  String(markdown || '')
    .split('\n')
    .forEach((raw) => {
      const line = raw.trim()
      const heading = line.match(/^(#{1,6})\s+(.*)$/)
      const bullet = line.match(/^[-*]\s+(.*)$/)
      const ordered = line.match(/^\d+[.)]\s+(.*)$/)
      if (!line) {
        flushPara()
        flushList()
      } else if (heading) {
        flushPara()
        flushList()
        blocks.push({ type: 'h', level: Math.min(4, heading[1].length + 1), text: heading[2] })
      } else if (bullet || ordered) {
        flushPara()
        const type = bullet ? 'ul' : 'ol'
        if (!list || list.type !== type) {
          flushList()
          list = { type, items: [] }
        }
        list.items.push((bullet || ordered)[1])
      } else {
        flushList()
        para.push(line)
      }
    })
  flushPara()
  flushList()
  return blocks
}

export function Markdown({ text, headingOffset = 0 }) {
  return (
    <div className={styles.prose}>
      {parse(text).map((b, i) => {
        if (b.type === 'h') {
          const Tag = `h${Math.min(6, b.level + headingOffset)}`
          return <Tag key={i}>{inline(b.text, i)}</Tag>
        }
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type
          return (
            <Tag key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{inline(item, `${i}-${j}`)}</li>
              ))}
            </Tag>
          )
        }
        return <p key={i}>{inline(b.text, i)}</p>
      })}
    </div>
  )
}
