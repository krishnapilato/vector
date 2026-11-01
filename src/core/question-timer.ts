import type { Config } from '../config/config'

/**
 * Pure core module: no React, no browser APIs. Everything under src/core is
 * framework-free so it can be tested in milliseconds and reused if the UI changes.
 */

export type QuestionKind = 'recall' | 'reasoning' | 'calculation' | 'open'

export type StudyMode = 'understand' | 'practice' | 'exam'

/** Seconds allowed for a question, or null when the mode has no per-question timer. */
export function timeLimitFor(
  kind: QuestionKind,
  config: Config,
  mode: StudyMode = 'practice',
): number | null {
  if (mode !== 'practice') return null
  return config.timers[kind]
}

export type TimedOutcome = 'answered' | 'unknown'

/** A question whose time ran out counts as "don't know", not as wrong. */
export function outcomeAfter(elapsedSeconds: number, limit: number | null): TimedOutcome {
  if (limit === null) return 'answered'
  return elapsedSeconds >= limit ? 'unknown' : 'answered'
}

/** Remaining fraction in [0, 1], used to draw the thin progress line (no numbers on screen). */
export function remainingFraction(elapsedSeconds: number, limit: number | null): number {
  if (limit === null) return 1
  return Math.min(1, Math.max(0, 1 - elapsedSeconds / limit))
}

export function formatSeconds(value: number | null): string {
  if (value === null) return 'nessuno'
  const m = Math.floor(value / 60)
  const s = value % 60
  return m === 0 ? `${s} s` : `${m}:${String(s).padStart(2, '0')}`
}
