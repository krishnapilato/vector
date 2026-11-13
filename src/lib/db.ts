/**
 * IndexedDB through Dexie (PIANO-V3 §8). Everything Vector knows lives here, in this browser.
 * Schema changes add a new `version(n)` with an upgrade; old versions are never edited.
 */
import Dexie, { type EntityTable } from 'dexie'
import type {
  ActiveSession,
  Block,
  Calibration,
  Chapter,
  Exercise,
  Milestone,
  Session,
  Settings,
  SimLesson,
  WeeklyReview,
} from '../core/model/schemas'

/** Sync credentials derived from the passphrase. The AES key is stored non-extractable. */
export interface SyncKeys {
  id: 'sync'
  vaultId: string
  token: string
  key: CryptoKey
  version: number
  lastSyncAt: number | null
}

export class VectorDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  chapters!: EntityTable<Chapter, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  simLessons!: EntityTable<SimLesson, 'id'>
  blocks!: EntityTable<Block, 'id'>
  sessions!: EntityTable<Session, 'id'>
  calibrations!: EntityTable<Calibration, 'station'>
  milestones!: EntityTable<Milestone, 'id'>
  weeklyReviews!: EntityTable<WeeklyReview, 'week'>
  active!: EntityTable<ActiveSession, 'id'>
  sync!: EntityTable<SyncKeys, 'id'>

  constructor(name = 'vector') {
    super(name)
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
  }

  /** The tables that make up a snapshot (everything except sync credentials). */
  get dataTables() {
    return [
      this.settings,
      this.chapters,
      this.exercises,
      this.simLessons,
      this.blocks,
      this.sessions,
      this.calibrations,
      this.milestones,
      this.weeklyReviews,
      this.active,
    ]
  }
}

export const db = new VectorDB()
