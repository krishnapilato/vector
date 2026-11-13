/** Logbook totals (PIANO-V3-LITE §4.2). Pure: the start of the week comes from the caller. */
import type { FocusAggregates, Session } from '../model/schemas'

export interface Totals {
  totalHours: number
  weekHours: number
  weekSessions: number
  /** Mean focus of camera sessions, weighted by their length; null without camera sessions. */
  averageFocusPct: number | null
}

const hours = (sessions: readonly Session[]) =>
  Math.round((sessions.reduce((n, s) => n + s.activeSeconds, 0) / 3600) * 10) / 10

export function totals(sessions: readonly Session[], weekStartMs: number): Totals {
  const withCamera = sessions.filter(
    (s): s is Session & { focusAggregates: FocusAggregates } =>
      s.focusAggregates !== null && s.activeSeconds > 0,
  )
  const thisWeek = sessions.filter((s) => s.startedAt >= weekStartMs)
  const weight = withCamera.reduce((n, s) => n + s.activeSeconds, 0)
  const focus = withCamera.reduce(
    (n, s) => n + s.focusAggregates.focusScorePct * s.activeSeconds,
    0,
  )
  return {
    totalHours: hours(sessions),
    weekHours: hours(thisWeek),
    weekSessions: thisWeek.length,
    averageFocusPct: weight > 0 ? Math.round(focus / weight) : null,
  }
}

/** The most recent distinct tags, for suggestions on the Focus screen. */
export function recentTags(sessions: readonly Session[], limit = 6): string[] {
  const out: string[] = []
  for (const s of sessions.toSorted((a, b) => b.startedAt - a.startedAt)) {
    const tag = s.tag.trim()
    if (tag && !out.some((x) => x.toLowerCase() === tag.toLowerCase())) out.push(tag)
    if (out.length === limit) break
  }
  return out
}

/** Monday 00:00 local time of the week containing `now`. */
export function weekStart(now: Date): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}
