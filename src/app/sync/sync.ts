/** Client side of the optional encrypted sync, and encrypted backup files. */
import { decrypt, encrypt, isEnvelope, syncIdentity } from '../../core/sync/crypto'
import { exportSnapshot, importSnapshot, type SyncSettings } from '../data/db'

export class SyncError extends Error {}
export class SyncConflict extends SyncError {
  constructor(public serverVersion: number) {
    super('Un altro dispositivo ha inviato dati più recenti: ricevili prima di inviare.')
  }
}

function endpoint(url: string, id: string): string {
  const base = url.trim().replace(/\/+$/, '')
  if (!/^https:\/\//.test(base) && !/^http:\/\/localhost(:\d+)?$/.test(base))
    throw new SyncError('L’indirizzo del server deve iniziare con https://')
  return `${base}/v1/${id}`
}

async function request(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { ...init, cache: 'no-store' })
  } catch {
    throw new SyncError('Server non raggiungibile.')
  }
}

function explain(status: number): string {
  if (status === 403)
    return 'Accesso negato: frase segreta diversa, o indirizzo dell’app non autorizzato nel server.'
  if (status === 413) return 'Dati troppo grandi per il server.'
  return `Il server ha risposto con un errore (${status}).`
}

export async function push(s: SyncSettings): Promise<{ version: number }> {
  if (!s.url || !s.passphrase) throw new SyncError('Imposta server e frase segreta.')
  const { id, token } = await syncIdentity(s.passphrase)
  const body = JSON.stringify(await encrypt(JSON.stringify(await exportSnapshot()), s.passphrase))
  const res = await request(endpoint(s.url, id), {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-base-version': String(s.version),
    },
    body,
  })
  if (res.status === 409)
    throw new SyncConflict(((await res.json()) as { version: number }).version)
  if (!res.ok) throw new SyncError(explain(res.status))
  return (await res.json()) as { version: number }
}

/** Returns null when the server has nothing yet. */
export async function pull(s: SyncSettings): Promise<{ version: number } | null> {
  if (!s.url || !s.passphrase) throw new SyncError('Imposta server e frase segreta.')
  const { id, token } = await syncIdentity(s.passphrase)
  const res = await request(endpoint(s.url, id), { headers: { authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new SyncError(explain(res.status))
  const version = Number(res.headers.get('x-version') ?? '0')
  const envelope: unknown = await res.json()
  if (!isEnvelope(envelope)) throw new SyncError('Dati sul server non riconosciuti.')
  await importSnapshot(JSON.parse(await decrypt(envelope, s.passphrase)))
  return { version }
}

export async function encryptedBackup(passphrase: string): Promise<Blob> {
  const envelope = await encrypt(JSON.stringify(await exportSnapshot()), passphrase)
  return new Blob([JSON.stringify(envelope)], { type: 'application/json' })
}

/** Restores a backup file: encrypted (needs the passphrase) or plain. */
export async function restoreBackup(text: string, passphrase: string | null): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new SyncError('Il file non è un backup di Vector.')
  }
  if (isEnvelope(parsed)) {
    if (!passphrase) throw new SyncError('Questo backup è cifrato: inserisci la frase segreta.')
    parsed = JSON.parse(await decrypt(parsed, passphrase))
  }
  await importSnapshot(parsed)
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
