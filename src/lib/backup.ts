/**
 * Backup and device-to-device transfer (PIANO-V3 §8, ADR 0004): a JSON file, encrypted when a
 * passphrase is given. Importing validates everything with Zod before any write.
 */
import { localDate } from '../core/calendar/dates'
import { Snapshot } from '../core/model/schemas'
import { decryptFile, encryptFile, isEnvelope } from './crypto'
import { exportSnapshot, saveSettings } from './repo'

export const maxImportBytes = 20 * 1024 * 1024

export async function buildBackup(passphrase: string | null): Promise<File> {
  const snapshot = await exportSnapshot()
  const json = JSON.stringify(snapshot)
  const body = passphrase ? JSON.stringify(await encryptFile(json, passphrase)) : json
  const name = `vector-${localDate(Date.now())}${passphrase ? '-encrypted' : ''}.json`
  await saveSettings({ lastBackupAt: Date.now() })
  return new File([body], name, { type: 'application/json' })
}

/** Opens the share sheet where the browser can share files (phones), else downloads. */
export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export type ReadResult =
  | { kind: 'ok'; snapshot: Snapshot }
  | { kind: 'needs-passphrase' }
  | { kind: 'invalid' }
  | { kind: 'too-big' }

/** Reads a backup file. Throws WrongPassphrase when the passphrase does not open it. */
export async function readBackup(file: File, passphrase: string | null): Promise<ReadResult> {
  if (file.size > maxImportBytes) return { kind: 'too-big' }
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return { kind: 'invalid' }
  }
  if (isEnvelope(parsed)) {
    if (!passphrase) return { kind: 'needs-passphrase' }
    try {
      parsed = JSON.parse(await decryptFile(parsed, passphrase))
    } catch (e) {
      if (e instanceof SyntaxError) return { kind: 'invalid' }
      throw e
    }
  }
  const result = Snapshot.safeParse(parsed)
  return result.success ? { kind: 'ok', snapshot: result.data } : { kind: 'invalid' }
}
