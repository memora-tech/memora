import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'icons')
mkdirSync(out, { recursive: true })

const BRAND = [0x00, 0xa1, 0xe0]
const INK = [0xfa, 0xfa, 0xf7]

const table = new Int32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  table[n] = c
}
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

const segments = [
  [0.22, 0.78, 0.22, 0.24],
  [0.22, 0.24, 0.5, 0.58],
  [0.5, 0.58, 0.78, 0.24],
  [0.78, 0.24, 0.78, 0.78]
]

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const l2 = dx * dx + dy * dy
  let tt = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0
  tt = Math.max(0, Math.min(1, tt))
  const cx = x1 + tt * dx
  const cy = y1 + tt * dy
  return Math.hypot(px - cx, py - cy)
}

function render(size, { maskable = false, transparentOutside = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const ss = 3
  const radius = maskable ? 0 : size * 0.22
  const stroke = size * 0.085
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgCover = 0
      let inkCover = 0
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) / ss
          const py = y + (sy + 0.5) / ss
          let inside = true
          if (!maskable) {
            const cx = Math.min(Math.max(px, radius), size - radius)
            const cy = Math.min(Math.max(py, radius), size - radius)
            inside = Math.hypot(px - cx, py - cy) <= radius
          }
          if (inside) bgCover += 1
          const nx = px / size
          const ny = py / size
          const pad = maskable ? 0.1 : 0
          const scale = 1 - pad * 2
          let d = Infinity
          for (const [x1, y1, x2, y2] of segments) d = Math.min(d, distToSegment(nx, ny, pad + x1 * scale, pad + y1 * scale, pad + x2 * scale, pad + y2 * scale))
          if (d * size <= stroke / 2 && inside) inkCover += 1
        }
      }
      const total = ss * ss
      const i = (y * size + x) * 4
      const bgA = bgCover / total
      const inkA = inkCover / total
      const r = BRAND[0] * (1 - inkA) + INK[0] * inkA
      const g = BRAND[1] * (1 - inkA) + INK[1] * inkA
      const b = BRAND[2] * (1 - inkA) + INK[2] * inkA
      rgba[i] = Math.round(r)
      rgba[i + 1] = Math.round(g)
      rgba[i + 2] = Math.round(b)
      rgba[i + 3] = Math.round((transparentOutside ? bgA : Math.max(bgA, maskable ? 1 : 0)) * 255)
    }
  }
  return encodePng(size, size, rgba)
}

writeFileSync(join(out, 'icon-192.png'), render(192, { transparentOutside: true }))
writeFileSync(join(out, 'icon-512.png'), render(512, { transparentOutside: true }))
writeFileSync(join(out, 'maskable-512.png'), render(512, { maskable: true }))
writeFileSync(
  join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#00A1E0"/><path d="M14 50V15.5L32 37l18-21.5V50" fill="none" stroke="#FAFAF7" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`
)
process.stdout.write(`Ícones gerados em ${out}\n`)
