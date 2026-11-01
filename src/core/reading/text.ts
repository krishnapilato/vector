/**
 * Turns the positioned text of a PDF page into readable paragraphs.
 * Pure: it receives pdf.js text items and returns plain text with paragraphs
 * separated by a blank line, so it can be tested without a PDF.
 */

export interface TextItem {
  str: string
  x: number
  /** PDF coordinates: y grows upwards. */
  y: number
  width: number
  height: number
}

interface Line {
  y: number
  height: number
  text: string
}

const PAGE_NUMBER = /^\s*(?:page\s*)?\d+(?:\s*[-–]\s*\d+)?\s*$/i

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 0
}

function toLines(items: readonly TextItem[]): Line[] {
  const sorted = items.filter((i) => i.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: { y: number; height: number; items: TextItem[] }[] = []
  for (const item of sorted) {
    const tolerance = Math.max(2, item.height * 0.5)
    const line = lines.find((l) => Math.abs(l.y - item.y) <= tolerance)
    if (line) line.items.push(item)
    else lines.push({ y: item.y, height: item.height, items: [item] })
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const parts = l.items.sort((a, b) => a.x - b.x)
      let text = ''
      let end: number | null = null
      for (const p of parts) {
        const gap = end === null ? 0 : p.x - end
        const needsSpace =
          end !== null &&
          gap > Math.max(1, p.height * 0.15) &&
          !text.endsWith(' ') &&
          !p.str.startsWith(' ')
        text += (needsSpace ? ' ' : '') + p.str
        end = p.x + p.width
      }
      return {
        y: l.y,
        height: Math.max(...l.items.map((i) => i.height)),
        text: text.replace(/\s+/g, ' ').trim(),
      }
    })
    .filter((l) => l.text.length > 0)
}

/** Joins two lines of the same paragraph, removing end-of-line hyphenation. */
function join(a: string, b: string): string {
  if (/[A-Za-zÀ-ÿ]-$/.test(a) && /^[a-zà-ÿ]/.test(b)) return a.slice(0, -1) + b
  return `${a} ${b}`
}

export function itemsToText(items: readonly TextItem[]): string {
  const lines = toLines(items)
  const body = lines.filter(
    (l, i) => !((i === 0 || i === lines.length - 1) && PAGE_NUMBER.test(l.text)),
  )
  if (body.length === 0) return ''
  const lineHeight = median(body.map((l) => l.height)) || 10

  const paragraphs: string[] = []
  let current = body[0]?.text ?? ''
  for (let i = 1; i < body.length; i++) {
    const prev = body[i - 1] as Line
    const line = body[i] as Line
    const gap = prev.y - line.y
    if (gap > lineHeight * 1.8) {
      paragraphs.push(current)
      current = line.text
    } else {
      current = join(current, line.text)
    }
  }
  paragraphs.push(current)
  return paragraphs.join('\n\n')
}

/** Paragraphs of a page with their offsets in the page text (for highlights). */
export function paragraphs(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []
  let start = 0
  for (const part of text.split('\n\n')) {
    if (part.length > 0) out.push({ text: part, start })
    start += part.length + 2
  }
  return out
}

export interface SearchHit {
  page: number
  index: number
  before: string
  match: string
  after: string
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Case- and accent-insensitive search across pages. Folding keeps string length for Latin text. */
export function searchPages(
  pages: readonly { page: number; text: string }[],
  query: string,
  limit = 50,
): SearchHit[] {
  const q = fold(query.trim())
  if (q.length < 2) return []
  const hits: SearchHit[] = []
  for (const p of pages) {
    const hay = fold(p.text)
    let from = 0
    for (;;) {
      const index = hay.indexOf(q, from)
      if (index === -1) break
      hits.push({
        page: p.page,
        index,
        before: p.text.slice(Math.max(0, index - 60), index).replace(/\s+/g, ' '),
        match: p.text.slice(index, index + q.length),
        after: p.text.slice(index + q.length, index + q.length + 60).replace(/\s+/g, ' '),
      })
      if (hits.length >= limit) return hits
      from = index + q.length
    }
  }
  return hits
}
