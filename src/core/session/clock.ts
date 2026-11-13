/** Formats a duration as m:ss, rounding up so the clock never shows 0:00 while time is left. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Share of the block already done, from 0 to 1. */
export function elapsedShare(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 1
  return Math.min(1, Math.max(0, 1 - remainingMs / totalMs))
}
