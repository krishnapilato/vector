/**
 * Runs sync in the background on every page when it is on: at start, when the device comes back
 * online or to the foreground, and a few seconds after each change. Failures stay quiet; the
 * Settings page shows the last successful sync. The sync code (and Zod) loads only when on.
 */
import { db } from './db'
import { changedEvent } from './events'

const debounceMs = 4000
let timer: ReturnType<typeof setTimeout> | undefined

async function quietly() {
  try {
    const { syncNow } = await import('./sync')
    await syncNow()
  } catch {
    // Offline or a server hiccup: the next change or visit tries again.
  }
}

export async function startSyncRunner(): Promise<void> {
  if (!(await db.sync.get('sync'))) return
  void quietly()
  window.addEventListener('online', () => void quietly())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void quietly()
  })
  window.addEventListener(changedEvent, () => {
    clearTimeout(timer)
    timer = setTimeout(() => void quietly(), debounceMs)
  })
}
