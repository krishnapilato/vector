import { msg } from '../i18n'
/** Imported study material: books, chapters and manual highlights. */

export type Reliability = 'official' | 'textbook' | 'notes'

export const reliabilityLabel: Record<Reliability, string> = {
  official: msg('Fonte ufficiale'),
  textbook: msg('Libro di testo'),
  notes: msg('Appunti'),
}

export interface Chapter {
  title: string
  /** 1-based, inclusive. */
  startPage: number
  endPage: number
}

export interface Book {
  id: string
  title: string
  language: 'it' | 'en'
  reliability: Reliability
  /** Subject the whole book belongs to, if any. */
  subjectId: string | null
  pageCount: number
  chapters: Chapter[]
  /** True when the original PDF is stored, so the page view is available. */
  hasFile: boolean
  importedAt: string
  lastPage: number
  /** Pages opened at least once, for reading progress. */
  readPages: number[]
}

export interface BookPage {
  bookId: string
  page: number
  text: string
}

/** Chapters from the PDF outline; without one, groups of `chunk` pages. */
export function chaptersFromOutline(
  entries: readonly { title: string; page: number }[],
  pageCount: number,
  chunk = 20,
): Chapter[] {
  const valid = entries
    .filter((e) => e.page >= 1 && e.page <= pageCount && e.title.trim())
    .sort((a, b) => a.page - b.page)
    .filter((e, i, all) => i === 0 || e.page !== all[i - 1]?.page)

  if (valid.length === 0) {
    const out: Chapter[] = []
    for (let start = 1; start <= pageCount; start += chunk) {
      const endPage = Math.min(pageCount, start + chunk - 1)
      out.push({ title: `Pagine ${start}–${endPage}`, startPage: start, endPage })
    }
    return out
  }

  const chapters: Chapter[] = []
  const first = valid[0]
  if (first && first.page > 1) {
    chapters.push({ title: 'Inizio', startPage: 1, endPage: first.page - 1 })
  }
  valid.forEach((e, i) => {
    const next = valid[i + 1]
    chapters.push({
      title: e.title.trim().replace(/\s+/g, ' '),
      startPage: e.page,
      endPage: next ? next.page - 1 : pageCount,
    })
  })
  return chapters
}

export function chapterOf(book: Pick<Book, 'chapters'>, page: number): Chapter | null {
  return book.chapters.find((c) => page >= c.startPage && page <= c.endPage) ?? null
}

export function readingProgress(book: Pick<Book, 'readPages' | 'pageCount'>): number {
  return book.pageCount === 0 ? 0 : new Set(book.readPages).size / book.pageCount
}

export interface Highlight {
  id: string
  bookId: string
  page: number
  /** Offsets into the stored page text, which never changes after import. */
  start: number
  end: number
  quote: string
  note: string | null
  createdAt: string
}

/** Trims whitespace off a selection; null if nothing is left. */
export function normalizeSelection(
  pageText: string,
  start: number,
  end: number,
): { start: number; end: number; quote: string } | null {
  let a = Math.max(0, Math.min(start, end))
  let b = Math.min(pageText.length, Math.max(start, end))
  while (a < b && /\s/.test(pageText[a] as string)) a++
  while (b > a && /\s/.test(pageText[b - 1] as string)) b--
  if (b <= a) return null
  return { start: a, end: b, quote: pageText.slice(a, b) }
}

export interface Segment {
  text: string
  start: number
  end: number
  highlightIds: string[]
}

/** Splits [from, to) of the page text into runs, each covered by the same set of highlights. */
export function segments(
  pageText: string,
  from: number,
  to: number,
  highlights: readonly Pick<Highlight, 'id' | 'start' | 'end'>[],
): Segment[] {
  const cuts = new Set([from, to])
  for (const h of highlights) {
    if (h.start > from && h.start < to) cuts.add(h.start)
    if (h.end > from && h.end < to) cuts.add(h.end)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const out: Segment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i] as number
    const end = points[i + 1] as number
    out.push({
      text: pageText.slice(start, end),
      start,
      end,
      highlightIds: highlights.filter((h) => h.start < end && h.end > start).map((h) => h.id),
    })
  }
  return out
}
