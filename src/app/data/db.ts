import Dexie, { type EntityTable } from 'dexie'
import { type Config, configSchema, defaultConfig } from '../../config/config'
import type { PlanItem } from '../../core/plan'
import type { Pomodoro } from '../../core/pomodoro'
import type { ConceptProgress } from '../../core/progress'
import { defaultSettings, type Session, type StudySettings } from '../../core/session'
import { DEFAULT_MODEL } from '../ai/model'

/** Everything lives in this browser's IndexedDB. Only the optional AI explanations reach Google, with the learner's own key. */

export interface AiSettings {
  /** The learner's own key. Stays on this device; excluded from exports. */
  apiKey: string | null
  model: string
}

export interface PlanSettings {
  /** YYYY-MM-DD, local date of the theory exam. */
  examDate: string | null
}

interface SettingsRow {
  id: 'settings'
  config: Config
  study: StudySettings
  ai?: AiSettings
  plan?: PlanSettings
}

/** One completed focus period: the honest "minutes studied". */
export interface FocusEntry {
  id: string
  endedAt: string
  minutes: number
}

interface TimerRow {
  id: 'pomodoro'
  pomodoro: Pomodoro
}

interface SessionRow {
  id: 'active'
  session: Session
}

class VectorDb extends Dexie {
  progress!: EntityTable<ConceptProgress, 'conceptId'>
  settings!: EntityTable<SettingsRow, 'id'>
  sessions!: EntityTable<SessionRow, 'id'>
  plan!: EntityTable<PlanItem, 'id'>
  focusLog!: EntityTable<FocusEntry, 'id'>
  timers!: EntityTable<TimerRow, 'id'>

  constructor() {
    super('vector')
    this.version(1).stores({
      progress: 'conceptId',
      settings: 'id',
      sessions: 'id',
    })
    this.version(2).stores({
      plan: 'id, start',
      focusLog: 'id, endedAt',
      timers: 'id',
    })
  }
}

export const db = new VectorDb()

export interface Preferences {
  config: Config
  study: StudySettings
  ai: AiSettings
  plan: PlanSettings
}

export async function loadPreferences(): Promise<Preferences> {
  const row = await db.settings.get('settings')
  const parsed = configSchema.safeParse(row?.config)
  const config = parsed.success ? parsed.data : defaultConfig
  return {
    config,
    study: { ...defaultSettings(config), ...row?.study },
    ai: { apiKey: null, model: DEFAULT_MODEL, ...row?.ai },
    plan: { examDate: null, ...row?.plan },
  }
}

export async function savePreferences(p: Preferences): Promise<void> {
  await db.settings.put({
    id: 'settings',
    config: configSchema.parse(p.config),
    study: p.study,
    ai: p.ai,
    plan: p.plan,
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

export const loadPlan = () => db.plan.orderBy('start').toArray()
export const savePlanItems = (items: PlanItem[]) => db.plan.bulkPut(items)
export const deletePlanItem = (id: string) => db.plan.delete(id)

export const loadFocusLog = () => db.focusLog.orderBy('endedAt').toArray()
export const addFocusEntry = (e: FocusEntry) => db.focusLog.put(e)

export async function loadPomodoro(): Promise<Pomodoro | null> {
  return (await db.timers.get('pomodoro'))?.pomodoro ?? null
}
export async function savePomodoro(p: Pomodoro | null): Promise<void> {
  if (p) await db.timers.put({ id: 'pomodoro', pomodoro: p })
  else await db.timers.delete('pomodoro')
}

/** A readable backup the learner can keep: their data, in their hands. */
export async function exportAll(): Promise<string> {
  const [progress, rows, plan, focusLog] = await Promise.all([
    db.progress.toArray(),
    db.settings.toArray(),
    db.plan.toArray(),
    db.focusLog.toArray(),
  ])
  // Never export the API key.
  const settings = rows.map(({ ai, ...rest }) => ({ ...rest, ai: ai && { model: ai.model } }))
  return JSON.stringify(
    { app: 'vector', version: 2, exportedAt: new Date(), progress, settings, plan, focusLog },
    null,
    2,
  )
}

export async function resetAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
