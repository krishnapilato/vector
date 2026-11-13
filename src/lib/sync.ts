/**
 * End-to-end encrypted sync through Supabase (ADR 0005). The server keeps one sealed blob per
 * passphrase: it never sees the data, the passphrase or the key. Each device pulls, merges with
 * the same merge as file import (nothing is lost), and pushes back with a version check.
 */
import { Snapshot } from '../core/model/schemas'
import { openVault, sealVault, vaultIdentity } from './crypto'
import { db } from './db'
import { exportSnapshot, mergeIn } from './repo'

/** Public by design: the publishable key only reaches the token-checked vault functions. */
export const supabaseUrl = 'https://gjerxjpchkyuddjiobze.supabase.co'
const publishableKey = 'sb_publishable_kwYqzmXd1hMkvITxBS0x2Q_VtXl2XVg'

export const syncedEvent = 'vector:synced'

export class SyncError extends Error {
  constructor(public readonly code: 'offline' | 'forbidden' | 'conflict' | 'server' | 'locked') {
    super(code)
  }
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new SyncError('offline')
  }
  if (res.ok) return (await res.json()) as T
  const error = (await res.json().catch(() => null)) as { message?: string } | null
  if (error?.message === 'version_conflict') throw new SyncError('conflict')
  if (error?.message === 'forbidden') throw new SyncError('forbidden')
  throw new SyncError('server')
}

export async function syncEnabled(): Promise<boolean> {
  return (await db.sync.get('sync')) !== undefined
}

export async function syncState() {
  return db.sync.get('sync')
}

/** Turns sync on for this device. The same passphrase on another device finds the same data. */
export async function enableSync(passphrase: string): Promise<void> {
  const { vaultId, token, key } = await vaultIdentity(passphrase)
  await db.sync.put({ id: 'sync', vaultId, token, key, version: 0, lastSyncAt: null })
  await syncNow()
}

export async function disableSync(deleteRemote: boolean): Promise<void> {
  const keys = await db.sync.get('sync')
  if (keys && deleteRemote)
    await rpc<boolean>('vault_delete', { p_id: keys.vaultId, p_token: keys.token })
  await db.sync.delete('sync')
}

let running: Promise<void> | null = null

/** Pull, merge, push. Safe to call often: concurrent calls share one run. */
export function syncNow(): Promise<void> {
  running ??= run().finally(() => {
    running = null
  })
  return running
}

async function run(attempt = 0): Promise<void> {
  const keys = await db.sync.get('sync')
  if (!keys) return
  const rows = await rpc<{ ciphertext: string; version: number }[]>('vault_get', {
    p_id: keys.vaultId,
    p_token: keys.token,
  })
  const remote = rows[0]
  let changed = false
  if (remote) {
    let parsed: unknown
    try {
      parsed = JSON.parse(await openVault(remote.ciphertext, keys.key))
    } catch {
      throw new SyncError('locked')
    }
    const snapshot = Snapshot.safeParse(parsed)
    if (!snapshot.success) throw new SyncError('server')
    const before = JSON.stringify(await exportSnapshot().then((s) => s.data))
    await mergeIn(snapshot.data, { silent: true })
    changed = JSON.stringify(await exportSnapshot().then((s) => s.data)) !== before
  }
  const local = await exportSnapshot()
  try {
    const version = await rpc<number>('vault_put', {
      p_id: keys.vaultId,
      p_token: keys.token,
      p_ciphertext: await sealVault(JSON.stringify(local), keys.key),
      p_expected_version: remote?.version ?? 0,
    })
    await db.sync.update('sync', { version, lastSyncAt: Date.now() })
  } catch (e) {
    // Another device pushed in between: pull its data too and try again.
    if (e instanceof SyncError && e.code === 'conflict' && attempt < 3) return run(attempt + 1)
    throw e
  }
  if (changed) window.dispatchEvent(new Event(syncedEvent))
}
