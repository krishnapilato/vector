/**
 * The session in progress, in localStorage (ADR 0010): readable before the database loads, so the
 * Focus screen can resume a running timer at once, and removed as soon as the session is saved.
 */
import type { ActiveSession } from '../core/model/schemas'

const key = 'vector.active'

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isNumberOrNull = (x: unknown) => x === null || isNumber(x)

/** Light shape check: a damaged entry is dropped rather than trusted. */
function valid(x: unknown): x is ActiveSession {
  const a = x as Partial<ActiveSession> | null
  const t = a?.timer
  return (
    !!a &&
    typeof a.tag === 'string' &&
    typeof a.cameraUsed === 'boolean' &&
    isNumberOrNull(a.hiddenAt) &&
    isNumberOrNull(a.endedAt) &&
    (a.focusAggregates === null || typeof a.focusAggregates === 'object') &&
    !!t &&
    isNumberOrNull(t.totalMs) &&
    isNumber(t.startedAt) &&
    isNumberOrNull(t.runningSince) &&
    isNumber(t.accumulatedMs) &&
    isNumber(t.pauses)
  )
}

export function loadActive(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (valid(parsed)) return parsed
    localStorage.removeItem(key)
  } catch {
    // Storage blocked or damaged: start fresh.
  }
  return null
}

export function storeActive(active: ActiveSession): void {
  try {
    localStorage.setItem(key, JSON.stringify(active))
  } catch {
    // Storage blocked: the session still runs, it just won't survive a reload.
  }
}

export function clearActive(): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to clear.
  }
}
