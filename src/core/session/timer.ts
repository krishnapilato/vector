/**
 * Session timer as a pure function of timestamps (ported from v2 pomodoro.ts): no intervals
 * inside, so it survives reloads and closing the browser and resumes exactly.
 */
import type { TimerState } from '../model/schemas'

export function startTimer(now: number, totalMs: number): TimerState {
  return { totalMs, startedAt: now, runningSince: now, accumulatedMs: 0, pauses: 0 }
}

/** Active (not paused) time so far. */
export function activeMs(t: TimerState, now: number): number {
  const running = t.runningSince === null ? 0 : Math.max(0, now - t.runningSince)
  return Math.min(t.totalMs, t.accumulatedMs + running)
}

export function remainingMs(t: TimerState, now: number): number {
  return Math.max(0, t.totalMs - activeMs(t, now))
}

export function isRunning(t: TimerState): boolean {
  return t.runningSince !== null
}

export function isFinished(t: TimerState, now: number): boolean {
  return remainingMs(t, now) === 0
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  if (t.runningSince === null) return t
  return { ...t, runningSince: null, accumulatedMs: activeMs(t, now), pauses: t.pauses + 1 }
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  if (t.runningSince !== null || isFinished(t, now)) return t
  return { ...t, runningSince: now }
}

/**
 * The learner left the app at `hiddenAt` and came back at `now`. If they stayed away longer than
 * `graceMs`, the timer is paused as of `hiddenAt + graceMs` (PIANO-V3 §5.3).
 */
export function applyAbsence(
  t: TimerState,
  hiddenAt: number,
  now: number,
  graceMs: number,
): { timer: TimerState; paused: boolean } {
  if (t.runningSince === null || now - hiddenAt <= graceMs) return { timer: t, paused: false }
  const pauseAt = Math.max(t.runningSince, hiddenAt + graceMs)
  return { timer: pauseTimer(t, pauseAt), paused: true }
}

/** Whole active minutes, rounded to the nearest minute. */
export function activeMinutes(t: TimerState, now: number): number {
  return Math.round(activeMs(t, now) / 60_000)
}
