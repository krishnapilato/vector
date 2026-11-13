/**
 * Calendar dates as `YYYY-MM-DD` strings (ported from v2 plan.ts). Pure: arithmetic runs on UTC
 * so it never shifts with daylight saving; "today" always comes in from the caller.
 */
import type { ISODate } from '../model/schemas'

const DAY_MS = 86_400_000

function toUtc(date: ISODate): number {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** The local calendar date of an instant. */
export function localDate(ms: number): ISODate {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
}

/** 0 for Monday … 6 for Sunday: weeks start on Monday. */
export function weekday(date: ISODate): number {
  return (new Date(toUtc(date)).getUTCDay() + 6) % 7
}

export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -weekday(date))
}

export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function isWeekend(date: ISODate): boolean {
  return weekday(date) >= 5
}

/** First day of the month containing `date`. */
export function monthStart(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`
}

export function addMonths(date: ISODate, months: number): ISODate {
  const [y = 1970, m = 1] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}
