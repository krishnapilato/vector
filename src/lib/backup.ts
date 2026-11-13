/** Backup files (PIANO-V3-LITE §4.3): JSON, encrypted when a passphrase is given. */
import { Backup } from '../core/model/schemas'
import { decryptFile, encryptFile, isEnvelope } from './crypto'
import { exportBackup } from './store'

export const maxImportBytes = 20 * 1024 * 1024

export async function backupFile(passphrase: string | null): Promise<File> {
  const json = JSON.stringify(await exportBackup())
  const body = passphrase ? JSON.stringify(await encryptFile(json, passphrase)) : json
  const day = new Date().toISOString().slice(0, 10)
  return new File([body], `vector-${day}${passphrase ? '-encrypted' : ''}.json`, {
    type: 'application/json',
  })
}

export function download(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ReadResult =
  | { kind: 'ok'; backup: Backup }
  | { kind: 'needs-passphrase' }
  | { kind: 'invalid' }

/** Validates a backup file with Zod before anything is written. Throws WrongPassphrase. */
export async function readBackup(file: File, passphrase: string | null): Promise<ReadResult> {
  if (file.size > maxImportBytes) return { kind: 'invalid' }
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
  const result = Backup.safeParse(parsed)
  return result.success ? { kind: 'ok', backup: result.data } : { kind: 'invalid' }
}
