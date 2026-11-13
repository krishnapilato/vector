/** What each block contains: reading ranges, spaced reviews, quizzes (PIANO-V3 §6, steps 3–5). */
import { addDays, daysBetween, localDate } from '../calendar/dates'
import type { Chapter, ISODate, Session } from '../model/schemas'

export const difficultyWeight = { 1: 1, 2: 1.3, 3: 1.6 } as const

/** Pages of a chapter a block of `minutes` covers, given the measured pace. */
export function pagesPerBlock(chapter: Chapter, pagesPer30: number, minutes: number): number {
  return Math.max(
    2,
    Math.round((pagesPer30 * (minutes / 30)) / difficultyWeight[chapter.difficulty]),
  )
}

export function nextPage(chapter: Chapter): number {
  return chapter.pageReached === null ? chapter.pageStart : chapter.pageReached + 1
}

export function pagesLeft(chapter: Chapter): number {
  if (chapter.status === 'done' || chapter.status === 'review') return 0
  return Math.max(0, chapter.pageEnd - nextPage(chapter) + 1)
}

/** Remaining pages weighted by difficulty (1 / 1.3 / 1.6). */
export function weightedPagesLeft(chapters: readonly Chapter[]): number {
  return chapters.reduce((sum, c) => sum + pagesLeft(c) * difficultyWeight[c.difficulty], 0)
}

export interface ReadingRange {
  chapter: Chapter
  from: number
  to: number
  finishesChapter: boolean
}

/**
 * Consecutive reading ranges in book order. A range never crosses into the next chapter and
 * never leaves fewer than 2 pages at the end of one.
 */
export function readingRanges(
  chapters: readonly Chapter[],
  pagesPer30: number,
  minutes: number,
  count: number,
): ReadingRange[] {
  const out: ReadingRange[] = []
  const queue = chapters.filter((c) => pagesLeft(c) > 0).toSorted((a, b) => a.order - b.order)
  let index = 0
  let page = queue[0] ? nextPage(queue[0]) : 0
  while (out.length < count && index < queue.length) {
    const chapter = queue[index]
    if (!chapter) break
    const size = pagesPerBlock(chapter, pagesPer30, minutes)
    let to = Math.min(chapter.pageEnd, page + size - 1)
    if (chapter.pageEnd - to < 2) to = chapter.pageEnd
    out.push({ chapter, from: page, to, finishesChapter: to === chapter.pageEnd })
    if (to === chapter.pageEnd) {
      index++
      const next = queue[index]
      page = next ? nextPage(next) : 0
    } else {
      page = to + 1
    }
  }
  return out
}

/** Review offsets in days after finishing a chapter (step 4). */
export function reviewOffsets(clarity: number | null): number[] {
  return clarity !== null && clarity >= 4 ? [14] : [3, 7, 21]
}

export interface DueReview {
  chapter: Chapter
  due: ISODate
  /** 1-based number of this review for the chapter. */
  nth: number
}

const sessionDate = (s: Session): ISODate => localDate(s.startedAt)

/** The next spaced review of each finished chapter, if one is still to do. */
export function dueReviews(
  chapters: readonly Chapter[],
  sessions: readonly Session[],
): DueReview[] {
  const out: DueReview[] = []
  for (const chapter of chapters) {
    if (!chapter.completedOn) continue
    const completedOn = chapter.completedOn
    const done = sessions.filter(
      (s) =>
        s.kind === 'review' &&
        s.ref?.type === 'chapter' &&
        s.ref.id === chapter.id &&
        daysBetween(completedOn, sessionDate(s)) >= 0,
    ).length
    const offsets = reviewOffsets(chapter.lastClarity)
    const offset = offsets[done]
    if (offset !== undefined)
      out.push({ chapter, due: addDays(completedOn, offset), nth: done + 1 })
  }
  return out.toSorted((a, b) => a.due.localeCompare(b.due) || a.chapter.order - b.chapter.order)
}

/**
 * Chapters ready for a quizppl.it quiz: read to the end and rated at least 3/5, never before
 * (step 5: understanding first, so the quiz is not learned by heart).
 */
export function quizReady(chapters: readonly Chapter[], sessions: readonly Session[]): Chapter[] {
  return chapters
    .filter(
      (c) =>
        c.completedOn !== null &&
        (c.lastClarity ?? 0) >= 3 &&
        !sessions.some((s) => s.kind === 'quiz' && s.ref?.type === 'chapter' && s.ref.id === c.id),
    )
    .toSorted((a, b) => a.order - b.order)
}
