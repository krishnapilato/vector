/**
 * Export and import (PIANO-V3-LITE §4.2, §4.3): the logbook as CSV, and the whole database as a
 * backup. Importing merges by id, so restoring a backup never loses a session recorded since.
 */
import type { Backup, Calibration, Session, Settings } from '../model/schemas'

/**
 * One CSV cell. Text a spreadsheet would run as a formula (starting with = + - @ or a control
 * character) gets a leading apostrophe; separators and quotes are quoted.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`
}

const iso = (ms: number) => new Date(ms).toISOString()

/** The logbook as CSV, oldest first. */
export function sessionsCsv(sessions: readonly Session[]): string {
  const rows = sessions
    .toSorted((a, b) => a.startedAt - b.startedAt)
    .map((s) => [
      iso(s.startedAt),
      iso(s.endedAt),
      s.tag,
      Math.round(s.activeSeconds / 60),
      s.pauseCount,
      s.cameraUsed ? 'yes' : 'no',
      s.focusAggregates ? s.focusAggregates.focusScorePct : null,
      s.focusAggregates ? s.focusAggregates.fatigueEvents : null,
      s.clarityRating,
      s.note,
    ])
  return toCsv(
    [
      'started',
      'ended',
      'tag',
      'active_min',
      'pauses',
      'camera',
      'focus_pct',
      'fatigue_events',
      'rating',
      'note',
    ],
    rows,
  )
}

export function makeBackup(
  settings: Settings | null,
  calibrations: readonly Calibration[],
  sessions: readonly Session[],
  now: number,
): Backup {
  return {
    app: 'vector',
    version: 3,
    exportedAt: now,
    settings,
    calibrations: [...calibrations],
    sessions: [...sessions],
  }
}

function union<T extends { id: string }>(
  local: readonly T[],
  incoming: readonly T[],
  pick: (a: T, b: T) => T,
): T[] {
  const map = new Map(local.map((x) => [x.id, x]))
  for (const x of incoming) {
    const existing = map.get(x.id)
    map.set(x.id, existing ? pick(existing, x) : x)
  }
  return [...map.values()]
}

export interface MergeResult {
  backup: Backup
  newSessions: number
  newCalibrations: number
}

/**
 * Merges an imported backup into the local data: sessions and calibrations from both sides are
 * kept (the newer calibration wins for the same id), settings come from the file.
 */
export function mergeBackups(local: Backup, incoming: Backup): MergeResult {
  const localIds = new Set(local.sessions.map((s) => s.id))
  const localCalibrations = new Set(local.calibrations.map((c) => c.id))
  const sessions = union(local.sessions, incoming.sessions, (a) => a).toSorted(
    (a, b) => a.startedAt - b.startedAt,
  )
  const calibrations = union(local.calibrations, incoming.calibrations, (a, b) =>
    b.createdAt > a.createdAt ? b : a,
  )
  return {
    backup: {
      app: 'vector',
      version: 3,
      exportedAt: Math.max(local.exportedAt, incoming.exportedAt),
      settings: incoming.settings ?? local.settings,
      calibrations,
      sessions,
    },
    newSessions: sessions.filter((s) => !localIds.has(s.id)).length,
    newCalibrations: calibrations.filter((c) => !localCalibrations.has(c.id)).length,
  }
}
