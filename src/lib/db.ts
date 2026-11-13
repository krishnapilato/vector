/**
 * IndexedDB through Dexie (PIANO-V3-LITE §7): three tables, settings, calibrations and sessions.
 * Schema changes add a new `version(n)` with an upgrade; old versions are never edited.
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Calibration, Session, Settings } from '../core/model/schemas'

/** A session as Vector 1.0.0 stored it, only the fields the upgrade reads. */
interface V1Session {
  id: string
  kind?: string
  content?: string
  startedAt: number
  endedAt: number
  activeMinutes?: number
  pauses?: number
  clarity?: number | null
  note?: string
  focus?: { attention?: number; activeSeconds?: number; focusedSeconds?: number } | null
}

export class VectorDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  calibrations!: EntityTable<Calibration, 'id'>
  sessions!: EntityTable<Session, 'id'>

  constructor(name = 'vector') {
    super(name)
    // Vector 1.0.0 (kept so existing data can be upgraded).
    this.version(1).stores({
      settings: 'id',
      chapters: 'id, order',
      exercises: 'id',
      simLessons: 'id, order',
      blocks: 'id, date, status',
      sessions: 'id, startedAt, blockId',
      calibrations: 'station',
      milestones: 'id',
      weeklyReviews: 'week',
      active: 'id',
      sync: 'id',
    })
    // Lite (ADR 0010): drop what is gone, keep every session in the new shape.
    this.version(2)
      .stores({
        settings: 'id',
        sessions: 'id, startedAt',
        calibrations: null,
        chapters: null,
        exercises: null,
        simLessons: null,
        blocks: null,
        milestones: null,
        weeklyReviews: null,
        active: null,
        sync: null,
      })
      .upgrade(async (tx) => {
        await tx.table('settings').clear()
        await tx
          .table('sessions')
          .toCollection()
          .modify((old: V1Session & Partial<Session>, ref) => {
            const focus = old.focus
            const rating = old.clarity
            ref.value = {
              id: old.id,
              tag: (old.content ?? old.kind ?? '').slice(0, 60),
              startedAt: old.startedAt,
              endedAt: old.endedAt,
              activeSeconds: Math.round((old.activeMinutes ?? 0) * 60),
              pauseCount: old.pauses ?? 0,
              cameraUsed: !!focus,
              focusAggregates: focus
                ? {
                    activeSeconds: focus.activeSeconds ?? 0,
                    focusedSeconds: focus.focusedSeconds ?? 0,
                    distractedSeconds: 0,
                    awaySeconds: 0,
                    distractionCount: 0,
                    fatigueEvents: 0,
                    breaksSuggested: 0,
                    breaksAccepted: 0,
                    focusScorePct: Math.round((focus.attention ?? 1) * 100),
                  }
                : null,
              clarityRating:
                rating === 1 || rating === 2 || rating === 4 || rating === 5 ? rating : 3,
              note: (old.note ?? '').slice(0, 200),
            } satisfies Session
          })
      })
    this.version(3).stores({ calibrations: 'id' })
  }
}

export const db = new VectorDB()
