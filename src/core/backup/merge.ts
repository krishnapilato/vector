/**
 * Merging an imported snapshot into the local one (ADR 0004). Nothing is ever overwritten
 * with less progress: sessions add up, each chapter keeps the furthest point reached, milestones
 * keep their first date. The same function would serve a future sync (docs/proposte.md).
 */
import type { Block, Chapter, SimLesson, Snapshot } from '../model/schemas'

export interface MergeSummary {
  newSessions: number
  chaptersAdvanced: { id: string; title: string; from: number | null; to: number | null }[]
  newMilestones: number
  activeSession: boolean
  settingsTaken: boolean
}

const chapterRank: Record<Chapter['status'], number> = {
  'not-started': 0,
  'in-progress': 1,
  review: 2,
  done: 2,
}
const blockRank: Record<Block['status'], number> = { planned: 0, skipped: 1, moved: 2, done: 3 }
const simRank: Record<SimLesson['status'], number> = { 'not-started': 0, repeat: 1, passed: 2 }

function progress(c: Chapter): number {
  return chapterRank[c.status] * 100_000 + (c.pageReached ?? 0)
}

function byId<T>(
  local: readonly T[],
  incoming: readonly T[],
  key: (x: T) => string,
  pick: (a: T, b: T) => T,
): T[] {
  const map = new Map<string, T>()
  for (const x of local) map.set(key(x), x)
  for (const x of incoming) {
    const k = key(x)
    const existing = map.get(k)
    map.set(k, existing === undefined ? x : pick(existing, x))
  }
  return [...map.values()]
}

export function mergeSnapshots(
  local: Snapshot,
  incoming: Snapshot,
): { merged: Snapshot; summary: MergeSummary } {
  const L = local.data
  const I = incoming.data
  const localSettings = L.settings[0]
  const incomingSettings = I.settings[0]
  const settingsTaken =
    !!incomingSettings &&
    (!localSettings?.onboarded ||
      (incomingSettings.onboarded && incomingSettings.updatedAt > localSettings.updatedAt))
  const settings = settingsTaken && incomingSettings ? [incomingSettings] : L.settings
  const lastBackups = [localSettings?.lastBackupAt, incomingSettings?.lastBackupAt].filter(
    (x): x is number => typeof x === 'number',
  )
  const mergedSettings = settings.map((s) => ({
    ...s,
    lastBackupAt: lastBackups.length > 0 ? Math.max(...lastBackups) : null,
  }))

  const chapters = byId(
    L.chapters,
    I.chapters,
    (c) => c.id,
    (a, b) => (progress(b) > progress(a) ? b : a),
  )
  const chaptersAdvanced = chapters.flatMap((c) => {
    const before = L.chapters.find((x) => x.id === c.id)
    return before && progress(c) > progress(before)
      ? [{ id: c.id, title: c.title, from: before.pageReached, to: c.pageReached }]
      : []
  })

  const localSessionIds = new Set(L.sessions.map((s) => s.id))
  const sessions = byId(
    L.sessions,
    I.sessions,
    (s) => s.id,
    (a) => a,
  ).toSorted((a, b) => a.startedAt - b.startedAt)

  const localMilestones = new Set(L.milestones.map((m) => m.id))
  const milestones = byId(
    L.milestones,
    I.milestones,
    (m) => m.id,
    (a, b) => ({
      id: a.id,
      reachedOn: [a.reachedOn, b.reachedOn].toSorted()[0] ?? a.reachedOn,
      seen: a.seen || b.seen,
    }),
  )

  // A session already logged on either device is not brought back to life.
  const logged = new Set(sessions.map((s) => s.startedAt))
  const active = [...L.active, ...I.active]
    .filter((a) => !logged.has(a.timer.startedAt))
    .toSorted((a, b) => b.timer.startedAt - a.timer.startedAt)
    .slice(0, 1)

  const merged: Snapshot = {
    app: 'vector',
    version: 1,
    exportedAt: Math.max(local.exportedAt, incoming.exportedAt),
    data: {
      settings: mergedSettings,
      chapters,
      exercises: byId(
        L.exercises,
        I.exercises,
        (e) => e.id,
        (a) => a,
      ),
      simLessons: byId(
        L.simLessons,
        I.simLessons,
        (l) => l.id,
        (a, b) =>
          simRank[b.status] > simRank[a.status]
            ? { ...b, attempts: Math.max(a.attempts, b.attempts) }
            : { ...a, attempts: Math.max(a.attempts, b.attempts) },
      ),
      blocks: byId(
        L.blocks,
        I.blocks,
        (b) => b.id,
        (a, b) => (blockRank[b.status] > blockRank[a.status] ? b : a),
      ),
      sessions,
      calibrations: byId(
        L.calibrations,
        I.calibrations,
        (c) => c.station,
        (a, b) => (b.date > a.date ? b : a),
      ),
      milestones,
      weeklyReviews: byId(
        L.weeklyReviews,
        I.weeklyReviews,
        (w) => w.week,
        (a, b) => (b.doneAt > a.doneAt ? b : a),
      ),
      active,
    },
  }

  return {
    merged,
    summary: {
      newSessions: sessions.filter((s) => !localSessionIds.has(s.id)).length,
      chaptersAdvanced,
      newMilestones: milestones.filter((m) => !localMilestones.has(m.id)).length,
      activeSession: I.active.length > 0 && active[0] === I.active[0],
      settingsTaken,
    },
  }
}
