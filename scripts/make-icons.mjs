// Draws the placeholder logo (PIANO-V3 §11: abstract, not tied to flying) as PNG app icons.
// Pure Node, no image libraries: run `node scripts/make-icons.mjs` after changing the shapes.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const paper = [248, 246, 241]
const ink = [36, 62, 140]

/** Coverage of the logo at a point in unit coordinates (0..1), before anti-aliasing. */
function inside(x, y) {
  const ring = Math.hypot(x - 0.5, y - 0.5)
  const dot = Math.hypot(x - 0.575, y - 0.425)
  return (ring > 0.25 && ring < 0.31) || dot < 0.075
}

function crcTable() {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
}
const table = crcTable()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const ss = 4
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++)
          if (inside((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)) hits++
      const a = hits / (ss * ss)
      const o = y * (size * 3 + 1) + 1 + x * 3
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(paper[i] * (1 - a) + ink[i] * a)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, png(size))
writeFileSync('public/apple-touch-icon.png', png(180))
console.log('Icons written to public/')
