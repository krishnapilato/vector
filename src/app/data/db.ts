import Dexie, { type EntityTable } from 'dexie'
import { type Config, configSchema, defaultConfig } from '../../config/config'
import type { ConceptProgress } from '../../core/progress'
import { defaultSettings, type Session, type StudySettings } from '../../core/session'
import { DEFAULT_MODEL } from '../ai/gemini'

/** Everything lives in this browser's IndexedDB. Only the optional AI explanations reach Google, with the learner's own key. */

export interface AiSettings {
  /** The learner's own key. Stays on this device; excluded from exports. */
  apiKey: string | null
  model: string
}

interface SettingsRow {
  id: 'settings'
  config: Config
  study: StudySettings
  ai?: AiSettings
}

interface SessionRow {
  id: 'active'
  session: Session
}

class VectorDb extends Dexie {
  progress!: EntityTable<ConceptProgress, 'conceptId'>
  settings!: EntityTable<SettingsRow, 'id'>
  sessions!: EntityTable<SessionRow, 'id'>

  constructor() {
    super('vector')
    this.version(1).stores({
      progress: 'conceptId',
      settings: 'id',
      sessions: 'id',
    })
  }
}

export const db = new VectorDb()

export interface Preferences {
  config: Config
  study: StudySettings
  ai: AiSettings
}

export async function loadPreferences(): Promise<Preferences> {
  const row = await db.settings.get('settings')
  const parsed = configSchema.safeParse(row?.config)
  const config = parsed.success ? parsed.data : defaultConfig
  return {
    config,
    study: { ...defaultSettings(config), ...row?.study },
    ai: { apiKey: null, model: DEFAULT_MODEL, ...row?.ai },
  }
}

export async function savePreferences(p: Preferences): Promise<void> {
  await db.settings.put({
    id: 'settings',
    config: configSchema.parse(p.config),
    study: p.study,
    ai: p.ai,
  })
}

export async function loadProgress(): Promise<Map<string, ConceptProgress>> {
  const rows = await db.progress.toArray()
  return new Map(rows.map((r) => [r.conceptId, r]))
}

export async function saveProgress(p: ConceptProgress): Promise<void> {
  await db.progress.put(p)
}

export async function loadActiveSession(): Promise<Session | null> {
  return (await db.sessions.get('active'))?.session ?? null
}

export async function saveActiveSession(session: Session | null): Promise<void> {
  if (session) await db.sessions.put({ id: 'active', session })
  else await db.sessions.delete('active')
}

/** A readable backup the learner can keep: their data, in their hands. */
export async function exportAll(): Promise<string> {
  const [progress, rows] = await Promise.all([db.progress.toArray(), db.settings.toArray()])
  // Never export the API key.
  const settings = rows.map(({ ai, ...rest }) => ({ ...rest, ai: ai && { model: ai.model } }))
  return JSON.stringify(
    { app: 'vector', version: 1, exportedAt: new Date(), progress, settings },
    null,
    2,
  )
}

export async function resetAll(): Promise<void> {
  await Promise.all([db.progress.clear(), db.settings.clear(), db.sessions.clear()])
}
