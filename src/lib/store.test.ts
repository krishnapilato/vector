/**
 * The database end to end, on an in-memory IndexedDB: backup → delete all → restore must give
 * back identical data (PIANO-V3-LITE F4), and data from Vector 1.0.0 must survive the upgrade.
 */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { Backup, type Session } from '../core/model/schemas'
import { decryptFile, encryptFile } from './crypto'
import { VectorDB } from './db'
import {
  deleteAll,
  exportBackup,
  getSettings,
  importBackup,
  listSessions,
  saveCalibration,
  saveSession,
  saveSettings,
} from './store'

const session = (id: string, startedAt: number): Session => ({
  id,
  tag: 'Deep work',
  startedAt,
  endedAt: startedAt + 1_800_000,
  activeSeconds: 1800,
  pauseCount: 1,
  cameraUsed: true,
  focusAggregates: {
    activeSeconds: 1800,
    focusedSeconds: 1550,
    distractedSeconds: 200,
    awaySeconds: 50,
    distractionCount: 2,
    fatigueEvents: 1,
    breaksSuggested: 1,
    breaksAccepted: 1,
    focusScorePct: 86,
  },
  clarityRating: 4,
  note: 'Stopped at page 124',
})

describe('backup and restore', () => {
  it('restores exactly what was exported, through an encrypted file', async () => {
    await saveSettings({ defaultDurationMin: 45, sensitivity: 'high' })
    await saveCalibration({
      id: 'desk',
      label: 'Desk',
      meanYaw: 1,
      sdYaw: 3,
      meanPitch: 25,
      sdPitch: 4,
      createdAt: 10,
    })
    await saveSession(session('a', 1000))
    await saveSession(session('b', 5000))

    const before = await exportBackup(42)
    const file = JSON.stringify(
      await encryptFile(JSON.stringify(before), 'calm river amber willow oak'),
    )

    await deleteAll()
    expect(await listSessions()).toEqual([])
    expect((await getSettings()).defaultDurationMin).toBe(30)

    const opened = JSON.parse(await decryptFile(JSON.parse(file), 'calm river amber willow oak'))
    const result = await importBackup(Backup.parse(opened))
    expect(result.newSessions).toBe(2)

    const after = await exportBackup(42)
    expect(after).toEqual(before)
    expect((await getSettings()).activeCalibrationId).toBe('desk')
  })

  it('never loses a session recorded after the backup', async () => {
    await deleteAll()
    await saveSession(session('old', 1))
    const backup = await exportBackup()
    await saveSession(session('new', 2))
    await importBackup(backup)
    expect((await listSessions()).map((s) => s.id)).toEqual(['new', 'old'])
  })
})

describe('upgrade from Vector 1.0.0', () => {
  it('keeps every session in the new shape and drops what Lite removed', async () => {
    const name = 'vector-upgrade-test'
    const old = new Dexie(name)
    old.version(1).stores({
      settings: 'id',
      sessions: 'id, startedAt, blockId',
      calibrations: 'station',
      blocks: 'id',
    })
    await old.table('sessions').bulkPut([
      {
        id: 's1',
        kind: 'reading',
        content: 'p. 112–124',
        startedAt: 100,
        endedAt: 200,
        activeMinutes: 32,
        pauses: 2,
        clarity: 5,
        note: 'Clear',
        focus: { attention: 0.84, activeSeconds: 1920, focusedSeconds: 1610 },
      },
      {
        id: 's2',
        kind: 'quiz',
        startedAt: 300,
        endedAt: 400,
        activeMinutes: 20,
        clarity: null,
        focus: null,
      },
    ])
    await old.table('blocks').put({ id: 'b1' })
    old.close()

    const db = new VectorDB(name)
    const sessions = await db.sessions.orderBy('startedAt').toArray()
    expect(sessions).toEqual([
      {
        id: 's1',
        tag: 'p. 112–124',
        startedAt: 100,
        endedAt: 200,
        activeSeconds: 1920,
        pauseCount: 2,
        cameraUsed: true,
        focusAggregates: {
          activeSeconds: 1920,
          focusedSeconds: 1610,
          distractedSeconds: 0,
          awaySeconds: 0,
          distractionCount: 0,
          fatigueEvents: 0,
          breaksSuggested: 0,
          breaksAccepted: 0,
          focusScorePct: 84,
        },
        clarityRating: 5,
        note: 'Clear',
      },
      {
        id: 's2',
        tag: 'quiz',
        startedAt: 300,
        endedAt: 400,
        activeSeconds: 1200,
        pauseCount: 0,
        cameraUsed: false,
        focusAggregates: null,
        clarityRating: 3,
        note: '',
      },
    ])
    expect(db.tables.map((t) => t.name).sort()).toEqual(['calibrations', 'sessions', 'settings'])
    db.close()
  })
})

describe('settings updates', () => {
  it('preserves independent settings changed concurrently', async () => {
    await deleteAll()
    await Promise.all([
      saveSettings({ defaultDurationMin: 45 }),
      saveSettings({ soundEnabled: false }),
      saveSettings({ sensitivity: 'high' }),
    ])
    expect(await getSettings()).toMatchObject({
      defaultDurationMin: 45,
      soundEnabled: false,
      sensitivity: 'high',
    })
  })
})
