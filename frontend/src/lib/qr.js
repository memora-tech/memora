import { hashString } from './ids.js'

export function qrMatrix(payload, size = 25) {
  const cells = []
  let seed = hashString(payload)
  const next = () => {
    seed ^= seed << 13
    seed >>>= 0
    seed ^= seed >>> 17
    seed ^= seed << 5
    seed >>>= 0
    return seed / 4294967296
  }
  const finder = (r, c) => {
    const inOuter = r >= 0 && r < 7 && c >= 0 && c < 7
    if (!inOuter) return null
    const ring = r === 0 || r === 6 || c === 0 || c === 6
    const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
    return ring || core
  }
  for (let r = 0; r < size; r += 1) {
    const row = []
    for (let c = 0; c < size; c += 1) {
      const f1 = finder(r, c)
      const f2 = finder(r, c - (size - 7))
      const f3 = finder(r - (size - 7), c)
      if (f1 !== null) row.push(f1)
      else if (f2 !== null) row.push(f2)
      else if (f3 !== null) row.push(f3)
      else if (r === 7 && c < 8) row.push(false)
      else if (c === 7 && r < 8) row.push(false)
      else if (r === 6 || c === 6) row.push((r + c) % 2 === 0)
      else row.push(next() > 0.52)
    }
    cells.push(row)
  }
  return cells
}
