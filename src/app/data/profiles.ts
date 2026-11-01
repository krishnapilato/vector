/**
 * Several people can study on the same device, each from zero: one IndexedDB database per
 * profile. The list of profiles lives in a small registry database; the active profile is
 * remembered in localStorage (a per-device convenience) and switching reloads the app.
 */
import Dexie, { type EntityTable } from 'dexie'

export interface Profile {
  id: string
  name: string
  /** IndexedDB database name. The first profile uses the original 'vector'. */
  database: string
  createdAt: string
}

const KEY = 'vector.profile'
export const DEFAULT_DATABASE = 'vector'

class Registry extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  constructor() {
    super('vector-profiles')
    this.version(1).stores({ profiles: 'id' })
  }
}

let registry: Registry | null = null
const reg = () => {
  registry ??= new Registry()
  return registry
}

export function activeDatabase(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_DATABASE
  } catch {
    return DEFAULT_DATABASE
  }
}

/** All profiles; the original database is always there as the first one. */
export async function listProfiles(): Promise<Profile[]> {
  const all = await reg().profiles.toArray()
  if (!all.some((p) => p.database === DEFAULT_DATABASE)) {
    const first: Profile = {
      id: 'default',
      name: 'Profilo principale',
      database: DEFAULT_DATABASE,
      createdAt: new Date(0).toISOString(),
    }
    await reg().profiles.put(first)
    all.unshift(first)
  }
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function createProfile(name: string): Promise<Profile> {
  const id = crypto.randomUUID()
  const p: Profile = {
    id,
    name: name.trim(),
    database: `vector-${id}`,
    createdAt: new Date().toISOString(),
  }
  await reg().profiles.put(p)
  return p
}

export async function renameProfile(id: string, name: string): Promise<void> {
  await reg().profiles.update(id, { name: name.trim() })
}

/** Deletes a profile and all its data. The active one and the first one can't be deleted. */
export async function deleteProfile(p: Profile): Promise<void> {
  if (p.database === DEFAULT_DATABASE || p.database === activeDatabase()) return
  await Dexie.delete(p.database)
  await reg().profiles.delete(p.id)
}

/** Returns false when the browser does not allow remembering the choice. */
export function switchTo(p: Profile): boolean {
  try {
    localStorage.setItem(KEY, p.database)
  } catch {
    return false
  }
  // Open the new profile on its home page.
  history.replaceState(null, '', `${location.pathname}${location.search}#/`)
  location.reload()
  return true
}
