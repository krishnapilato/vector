/** Logbook totals and simple statistics (PIANO-V3 §5.7) and the weekly review (§5.6). */
import { addDays, localDate, mondayOf, monthStart } from '../calendar/dates'
import type { Chapter, Feeling, ISODate, Session } from '../model/schemas'
import type { SubjectId } from '../model/subjects'

export interface Totals {
  hoursTotal: number
  hoursMonth: number
  hoursWeek: number
  simHours: number
  chaptersDone: number
  bookPercent: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function totals(
  sessions: readonly Session[],
  chapters: readonly Chapter[],
  today: ISODate,
): Totals {
  const monday = mondayOf(today)
  const month = monthStart(today)
  const study = sessions.filter((s) => s.kind !== 'simulator')
  const hours = (list: readonly Session[]) => list.reduce((n, s) => n + s.activeMinutes, 0) / 60
  const pagesTotal = chapters.reduce((n, c) => n + (c.pageEnd - c.pageStart + 1), 0)
  const pagesRead = chapters.reduce((n, c) => {
    if (c.completedOn) return n + (c.pageEnd - c.pageStart + 1)
    if (c.pageReached === null) return n
    return n + Math.max(0, Math.min(c.pageEnd, c.pageReached) - c.pageStart + 1)
  }, 0)
  return {
    hoursTotal: round1(hours(study)),
    hoursMonth: round1(hours(study.filter((s) => localDate(s.startedAt) >= month))),
    hoursWeek: round1(hours(study.filter((s) => localDate(s.startedAt) >= monday))),
    simHours: round1(hours(sessions.filter((s) => s.kind === 'simulator'))),
    chaptersDone: chapters.filter((c) => c.completedOn !== null).length,
    bookPercent: pagesTotal > 0 ? Math.round((pagesRead / pagesTotal) * 100) : 0,
  }
}

export const dayParts = ['early', 'morning', 'afternoon', 'evening', 'night'] as const
export type DayPart = (typeof dayParts)[number]

export function dayPart(ms: number): DayPart {
  const h = new Date(ms).getHours()
  if (h < 7) return h < 4 ? 'night' : 'early'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  if (h < 23) return 'evening'
  return 'night'
}

/** "When I work best": mean attention per part of the day, camera sessions only. */
export function bestHours(
  sessions: readonly Session[],
): { part: DayPart; attention: number; sessions: number }[] {
  return dayParts
    .map((part) => {
      const list = sessions.filter((s) => s.focus !== null && dayPart(s.startedAt) === part)
      const attention = list.length
        ? list.reduce((n, s) => n + (s.focus?.attention ?? 0), 0) / list.length
        : 0
      return { part, attention: Math.round(attention * 100), sessions: list.length }
    })
    .filter((x) => x.sessions > 0)
}

/** Clarity per subject: the last ratings in order, to see the trend. */
export function clarityBySubject(
  sessions: readonly Session[],
): { subject: SubjectId; ratings: number[]; mean: number }[] {
  const map = new Map<SubjectId, number[]>()
  for (const s of sessions.toSorted((a, b) => a.startedAt - b.startedAt)) {
    if (s.subject === null || s.clarity === null) continue
    map.set(s.subject, [...(map.get(s.subject) ?? []), s.clarity])
  }
  return [...map.entries()].map(([subject, ratings]) => ({
    subject,
    ratings: ratings.slice(-8),
    mean: round1(ratings.reduce((a, b) => a + b, 0) / ratings.length),
  }))
}

/** quizppl.it scores per chapter, in percent. */
export function quizByChapter(
  sessions: readonly Session[],
): { chapterId: string; scores: number[] }[] {
  const map = new Map<string, number[]>()
  for (const s of sessions.toSorted((a, b) => a.startedAt - b.startedAt)) {
    if (s.kind !== 'quiz' || !s.quizScore || s.ref?.type !== 'chapter') continue
    const pct = Math.round((s.quizScore.correct / s.quizScore.total) * 100)
    map.set(s.ref.id, [...(map.get(s.ref.id) ?? []), pct])
  }
  return [...map.entries()].map(([chapterId, scores]) => ({ chapterId, scores }))
}

/** Weekly review: the factor for next week's plan (−15% / same / +10%). */
export const feelingFactor: Record<Feeling, number> = { heavy: 0.85, right: 1, light: 1.1 }

export interface WeekSummary {
  monday: ISODate
  blocksDone: number
  activeHours: number
  pagesRead: number
  chaptersFinished: number
  best: Session | null
}

export function weekSummary(
  sessions: readonly Session[],
  chapters: readonly Chapter[],
  monday: ISODate,
): WeekSummary {
  const sunday = addDays(monday, 6)
  const inWeek = sessions.filter((s) => {
    const d = localDate(s.startedAt)
    return d >= monday && d <= sunday
  })
  const best =
    inWeek.toSorted(
      (a, b) =>
        (b.focus?.attention ?? 0) * b.activeMinutes - (a.focus?.attention ?? 0) * a.activeMinutes ||
        b.activeMinutes - a.activeMinutes,
    )[0] ?? null
  // Pages advanced this week: each reading session counts from the page reached before it.
  const lastPage = new Map<string, number>()
  let pagesRead = 0
  for (const x of sessions.toSorted((p, q) => p.startedAt - q.startedAt)) {
    if (x.ref?.type !== 'chapter' || x.pageReached === null) continue
    const chapter = chapters.find((c) => c.id === x.ref?.id)
    const before = lastPage.get(x.ref.id) ?? (chapter ? chapter.pageStart - 1 : x.pageReached)
    if (inWeek.includes(x) && x.kind === 'reading') pagesRead += Math.max(0, x.pageReached - before)
    lastPage.set(x.ref.id, Math.max(before, x.pageReached))
  }
  return {
    monday,
    blocksDone: inWeek.length,
    activeHours: round1(inWeek.reduce((n, s) => n + s.activeMinutes, 0) / 60),
    pagesRead,
    chaptersFinished: chapters.filter(
      (c) => c.completedOn !== null && c.completedOn >= monday && c.completedOn <= sunday,
    ).length,
    best,
  }
}

/** The review is offered on Sunday, or on Monday for the week just ended. */
export function reviewDue(today: ISODate, reviewedWeeks: readonly ISODate[]): ISODate | null {
  const monday = mondayOf(today)
  const day = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
  const week = day === 6 ? monday : day === 0 ? addDays(monday, -7) : null
  return week && !reviewedWeeks.includes(week) ? week : null
}
