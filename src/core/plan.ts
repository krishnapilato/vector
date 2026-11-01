/** Study planning: sessions on a calendar, the exam date, and an .ics export. */

export type PlanKind = 'study' | 'review' | 'exam-sim'

export const planKindLabel: Record<PlanKind, string> = {
  study: 'Studio',
  review: 'Ripasso',
  'exam-sim': 'Simulazione esame',
}

export interface PlanItem {
  id: string
  /** Local start time, ISO string. */
  start: string
  minutes: number
  kind: PlanKind
  subjectId: string | null
  done: boolean
}

const DAY = 24 * 60 * 60 * 1000

/** Local midnight of the given day. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())
}

/** Monday of the week containing `d` (weeks start on Monday, as in Italy). */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  const offset = (day.getDay() + 6) % 7
  return addDays(day, -offset)
}

export function weekDays(d: Date): Date[] {
  const monday = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function itemsOn(items: readonly PlanItem[], day: Date): PlanItem[] {
  return items
    .filter((i) => sameDay(new Date(i.start), day))
    .sort((a, b) => a.start.localeCompare(b.start))
}

/** The same session repeated weekly: `weeks` occurrences in total. */
export function repeatWeekly(
  base: Omit<PlanItem, 'id'>,
  weeks: number,
  makeId: () => string,
): PlanItem[] {
  const start = new Date(base.start)
  return Array.from({ length: Math.max(1, weeks) }, (_, i) => ({
    ...base,
    id: makeId(),
    start: addDays(start, i * 7).toISOString(),
  }))
}

export function nextPlanned(items: readonly PlanItem[], now: Date): PlanItem | null {
  return (
    items
      .filter((i) => !i.done && new Date(i.start).getTime() + i.minutes * 60_000 > now.getTime())
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  )
}

export interface Readiness {
  daysLeft: number
  /** Concepts never studied yet. */
  notStarted: number
  /** New concepts per day needed to start everything, keeping the last two weeks for review. */
  newPerDay: number | null
}

export function readiness(examDate: Date, today: Date, notStarted: number): Readiness {
  const daysLeft = Math.ceil((startOfDay(examDate).getTime() - startOfDay(today).getTime()) / DAY)
  if (daysLeft <= 0) return { daysLeft, notStarted, newPerDay: null }
  const reviewBuffer = daysLeft > 28 ? 14 : 0
  const studyDays = Math.max(1, daysLeft - reviewBuffer)
  return { daysLeft, notStarted, newPerDay: Math.ceil(notStarted / studyDays) }
}

function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** iCalendar file importable in Google Calendar, Outlook and Apple Calendar. */
export function toIcs(
  items: readonly PlanItem[],
  subjectName: (id: string) => string,
  now: Date,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vector//Piano di studio//IT',
    'CALSCALE:GREGORIAN',
  ]
  for (const i of items) {
    const start = new Date(i.start)
    const end = new Date(start.getTime() + i.minutes * 60_000)
    const title = [planKindLabel[i.kind], i.subjectId ? subjectName(i.subjectId) : null]
      .filter(Boolean)
      .join(' · ')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${i.id}@vector`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(`Vector · ${title}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
