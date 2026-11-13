/**
 * Session timer as a pure function of timestamps (ported from v2 pomodoro.ts): no intervals
 * inside, so it survives reloads and a sleeping browser and resumes exactly. A timer with no
 * total is Open: a stopwatch that never finishes on its own.
 */
import type { TimerState } from '../model/schemas'

export function startTimer(now: number, totalMs: number | null): TimerState {
  return { totalMs, startedAt: now, runningSince: now, accumulatedMs: 0, pauses: 0 }
}

/** Active (not paused) time so far. */
export function activeMs(t: TimerState, now: number): number {
  const running = t.runningSince === null ? 0 : Math.max(0, now - t.runningSince)
  const total = t.accumulatedMs + running
  return t.totalMs === null ? total : Math.min(t.totalMs, total)
}

/** Time left, or null for an Open session. */
export function remainingMs(t: TimerState, now: number): number | null {
  return t.totalMs === null ? null : Math.max(0, t.totalMs - activeMs(t, now))
}

export function isRunning(t: TimerState): boolean {
  return t.runningSince !== null
}

export function isFinished(t: TimerState, now: number): boolean {
  return remainingMs(t, now) === 0
}

/** Share of the planned time already done, 0–1; 0 for Open sessions. */
export function progress(t: TimerState, now: number): number {
  if (t.totalMs === null || t.totalMs <= 0) return 0
  return Math.min(1, activeMs(t, now) / t.totalMs)
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
 * The learner left the tab at `hiddenAt` and came back at `now`. If they stayed away longer than
 * `graceMs`, the timer is paused as of `hiddenAt + graceMs` (PIANO-V3-LITE §4.1 B).
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

/** Whole active seconds. */
export function activeSeconds(t: TimerState, now: number): number {
  return Math.floor(activeMs(t, now) / 1000)
}
