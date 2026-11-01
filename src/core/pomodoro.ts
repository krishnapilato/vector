import type { Config } from '../config/config'
import { msg } from './i18n'

/**
 * Pomodoro as a pure state machine over timestamps: no intervals inside,
 * so it survives reloads and keeps running while you study on another screen.
 */

export type PomodoroPhase = 'focus' | 'short-break' | 'long-break'

export const phaseLabel: Record<PomodoroPhase, string> = {
  focus: msg('Concentrazione'),
  'short-break': msg('Pausa breve'),
  'long-break': msg('Pausa lunga'),
}

export interface Pomodoro {
  phase: PomodoroPhase
  /** Epoch ms when the current phase ends; null while paused. */
  endsAt: number | null
  /** Remaining ms while paused. */
  remainingMs: number
  /** Focus periods completed in this run. */
  completed: number
}

export function phaseMs(phase: PomodoroPhase, cfg: Config['pomodoro']): number {
  const minutes =
    phase === 'focus'
      ? cfg.focusMinutes
      : phase === 'short-break'
        ? cfg.shortBreakMinutes
        : cfg.longBreakMinutes
  return minutes * 60_000
}

export function startPomodoro(now: number, cfg: Config['pomodoro']): Pomodoro {
  return { phase: 'focus', endsAt: now + phaseMs('focus', cfg), remainingMs: 0, completed: 0 }
}

export function remaining(p: Pomodoro, now: number): number {
  return p.endsAt === null ? p.remainingMs : Math.max(0, p.endsAt - now)
}

export function pause(p: Pomodoro, now: number): Pomodoro {
  if (p.endsAt === null) return p
  return { ...p, endsAt: null, remainingMs: remaining(p, now) }
}

export function resume(p: Pomodoro, now: number): Pomodoro {
  if (p.endsAt !== null) return p
  return { ...p, endsAt: now + p.remainingMs, remainingMs: 0 }
}

/** Moves to the next phase, from now. A focus period counts as completed only if it ran out. */
export function nextPhase(
  p: Pomodoro,
  now: number,
  cfg: Config['pomodoro'],
  finished: boolean,
): Pomodoro {
  if (p.phase === 'focus') {
    const completed = p.completed + (finished ? 1 : 0)
    const phase: PomodoroPhase =
      finished && completed % cfg.cyclesBeforeLongBreak === 0 ? 'long-break' : 'short-break'
    return { phase, endsAt: now + phaseMs(phase, cfg), remainingMs: 0, completed }
  }
  return { ...p, phase: 'focus', endsAt: now + phaseMs('focus', cfg), remainingMs: 0 }
}

/** If the running phase has ended, returns the next state and the phase that just finished. */
export function tick(
  p: Pomodoro,
  now: number,
  cfg: Config['pomodoro'],
): { state: Pomodoro; finished: PomodoroPhase | null } {
  if (p.endsAt === null || now < p.endsAt) return { state: p, finished: null }
  return { state: nextPhase(p, p.endsAt, cfg, true), finished: p.phase }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
