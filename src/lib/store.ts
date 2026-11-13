/** The app's reads and writes on the database (PIANO-V3-LITE §7). */
import { type MergeResult, makeBackup, mergeBackups } from '../core/export/export'
import { defaultSettings } from '../core/model/defaults'
import type { Backup, Calibration, Session, Settings } from '../core/model/schemas'
import { db } from './db'

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('default')) ?? defaultSettings()
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch }
    await db.settings.put(next)
    return next
  })
}

/** Asks the browser not to clear Vector's data on its own (§7, first save). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

export async function saveSession(session: Session): Promise<void> {
  await db.sessions.put(session)
  await requestPersistence()
}

export async function listSessions(): Promise<Session[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray()
}

export async function saveCalibration(calibration: Calibration): Promise<void> {
  await db.transaction('rw', [db.calibrations, db.settings], async () => {
    await db.calibrations.put(calibration)
    await saveSettings({ activeCalibrationId: calibration.id })
  })
}

export async function activeCalibration(): Promise<Calibration | undefined> {
  const { activeCalibrationId } = await getSettings()
  return activeCalibrationId ? db.calibrations.get(activeCalibrationId) : undefined
}

export async function exportBackup(now = Date.now()): Promise<Backup> {
  const [settings, calibrations, sessions] = await Promise.all([
    db.settings.get('default'),
    db.calibrations.toArray(),
    db.sessions.toArray(),
  ])
  return makeBackup(settings ?? null, calibrations, sessions, now)
}

/** Merges a validated backup in: nothing already here is lost (§4.3). */
export async function importBackup(incoming: Backup): Promise<MergeResult> {
  const result = mergeBackups(await exportBackup(0), incoming)
  await db.transaction('rw', [db.settings, db.calibrations, db.sessions], async () => {
    if (result.backup.settings) await db.settings.put(result.backup.settings)
    await db.calibrations.bulkPut(result.backup.calibrations)
    await db.sessions.bulkPut(result.backup.sessions)
  })
  return result
}

export async function deleteAll(): Promise<void> {
  await db.transaction('rw', [db.settings, db.calibrations, db.sessions], async () => {
    await Promise.all([db.settings.clear(), db.calibrations.clear(), db.sessions.clear()])
  })
}
