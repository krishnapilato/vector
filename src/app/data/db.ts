import Dexie, { type EntityTable } from 'dexie'
import { type Config, configSchema, defaultConfig } from '../../config/config'
import type { UserConcept } from '../../core/ai/questions'
import { defaultFocusSettings, type FocusSettings } from '../../core/focus/focus'
import type { PlanItem } from '../../core/plan'
import type { Pomodoro } from '../../core/pomodoro'
import type { ConceptProgress } from '../../core/progress'
import type { Book, BookPage, Highlight } from '../../core/reading/book'
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
  focus?: FocusSettings
  sync?: SyncSettings
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

/** The original file of an imported book, kept for the page view. */
interface BookFile {
  id: string
  blob: Blob
}

/** How often the learner looked a term up: a term looked up often is a term not known yet. */
export interface Lookup {
  term: string
  count: number
  lastAt: string
}

/** One answered question, for the error diary and the learner profile. Ids and short texts only. */
export interface Attempt {
  id: string
  at: string
  conceptId: string
  variantId: string
  verdict: string
  prompt: string
  chosen: string | null
  correct: string
  elapsedSeconds: number
  seenBefore: boolean
}

/** Aggregated focus events of one study session: numbers only, never images or audio. */
export interface FocusRecord {
  id: string
  endedAt: string
  kind?: 'study' | 'reading'
  sensors?: { camera: boolean; mic: boolean }
  seconds: number
  attentiveSeconds: number
  lookAways: number
  phoneSeen: number
  talking: number
  drowsy: number
  leftApp: number
}

/** Pen strokes on a book page (v1.3), stored as vectors. */
export interface Drawing {
  id: string
  bookId: string
  page: number
  strokes: { points: [number, number, number][]; width: number }[]
  updatedAt: string
}

class VectorDb extends Dexie {
  progress!: EntityTable<ConceptProgress, 'conceptId'>
  settings!: EntityTable<SettingsRow, 'id'>
  sessions!: EntityTable<SessionRow, 'id'>
  plan!: EntityTable<PlanItem, 'id'>
  focusLog!: EntityTable<FocusEntry, 'id'>
  timers!: EntityTable<TimerRow, 'id'>
  books!: EntityTable<Book, 'id'>
  bookPages!: Dexie.Table<BookPage, [string, number]>
  bookFiles!: EntityTable<BookFile, 'id'>
  highlights!: EntityTable<Highlight, 'id'>
  userConcepts!: EntityTable<UserConcept, 'id'>
  lookups!: EntityTable<Lookup, 'term'>
  attempts!: EntityTable<Attempt, 'id'>
  focusRecords!: EntityTable<FocusRecord, 'id'>
  drawings!: EntityTable<Drawing, 'id'>

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
    this.version(3).stores({
      books: 'id',
      bookPages: '[bookId+page], bookId',
      bookFiles: 'id',
      highlights: 'id, bookId, [bookId+page]',
      userConcepts: 'id, subjectId, origin.bookId',
      lookups: 'term',
      attempts: 'id, at, conceptId',
      focusRecords: 'id, endedAt',
      drawings: 'id, bookId, [bookId+page]',
    })
  }
}

export const db = new VectorDb()

export interface Preferences {
  config: Config
  study: StudySettings
  ai: AiSettings
  plan: PlanSettings
  focus: FocusSettings
  sync: SyncSettings
}

/** Optional encrypted sync through the learner's own server. */
export interface SyncSettings {
  url: string | null
  /** Stays on this device; never exported or synced. */
  passphrase: string | null
  /** Last server version this device has seen. */
  version: number
  lastSyncedAt: string | null
}

export const defaultSync: SyncSettings = {
  url: null,
  passphrase: null,
  version: 0,
  lastSyncedAt: null,
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
    focus: { ...defaultFocusSettings, ...row?.focus },
    sync: { ...defaultSync, ...row?.sync },
  }
}

export async function savePreferences(p: Preferences): Promise<void> {
  await db.settings.put({
    id: 'settings',
    config: configSchema.parse(p.config),
    study: p.study,
    ai: p.ai,
    plan: p.plan,
    focus: p.focus,
    sync: p.sync,
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

/* ---------- library ---------- */

export const loadBooks = () => db.books.toArray()
export const saveBook = (b: Book) => db.books.put(b)

export async function addBook(book: Book, pages: string[], file: Blob | null): Promise<void> {
  await db.transaction('rw', [db.books, db.bookPages, db.bookFiles], async () => {
    await db.books.put(book)
    await db.bookPages.bulkPut(pages.map((text, i) => ({ bookId: book.id, page: i + 1, text })))
    if (file) await db.bookFiles.put({ id: book.id, blob: file })
  })
  // Ask the browser not to evict imported books when space runs low.
  await navigator.storage?.persist?.().catch(() => false)
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.books, db.bookPages, db.bookFiles, db.highlights, db.drawings],
    async () => {
      await db.books.delete(id)
      await db.bookPages.where('bookId').equals(id).delete()
      await db.bookFiles.delete(id)
      await db.highlights.where('bookId').equals(id).delete()
      await db.drawings.where('bookId').equals(id).delete()
    },
  )
}

export const loadPage = (bookId: string, page: number) => db.bookPages.get([bookId, page])
export const loadPages = (bookId: string, from: number, to: number) =>
  db.bookPages.where('[bookId+page]').between([bookId, from], [bookId, to], true, true).toArray()
export const loadAllPages = (bookId: string) =>
  db.bookPages.where('bookId').equals(bookId).sortBy('page')
export const loadBookFile = async (bookId: string) => (await db.bookFiles.get(bookId))?.blob ?? null

export const loadHighlights = (bookId: string) =>
  db.highlights.where('bookId').equals(bookId).toArray()
export const saveHighlight = (h: Highlight) => db.highlights.put(h)
export const deleteHighlight = (id: string) => db.highlights.delete(id)

export const loadUserConcepts = () => db.userConcepts.toArray()
export const saveUserConcepts = (c: UserConcept[]) => db.userConcepts.bulkPut(c)
export const deleteUserConcept = (id: string) => db.userConcepts.delete(id)

export async function countLookup(term: string): Promise<number> {
  const key = term.toLowerCase().trim()
  const prev = await db.lookups.get(key)
  const count = (prev?.count ?? 0) + 1
  await db.lookups.put({ term: key, count, lastAt: new Date().toISOString() })
  return count
}
export const loadLookups = () => db.lookups.toArray()

/* ---------- study history ---------- */

export const addAttempt = (a: Attempt) => db.attempts.put(a)
export const loadAttempts = () => db.attempts.orderBy('at').toArray()
export const addFocusRecord = (r: FocusRecord) => db.focusRecords.put(r)
export const loadFocusRecords = () => db.focusRecords.orderBy('endedAt').toArray()

export const loadDrawing = (bookId: string, page: number) =>
  db.drawings.where('[bookId+page]').equals([bookId, page]).first()
export const saveDrawing = (d: Drawing) => db.drawings.put(d)

/** A readable backup the learner can keep: their data, in their hands. */
/** Forgets what Vector learned about how the learner studies. Progress and books stay. */
export async function clearLearningHistory(): Promise<void> {
  await db.transaction('rw', [db.attempts, db.focusRecords, db.lookups], async () => {
    await Promise.all([db.attempts.clear(), db.focusRecords.clear(), db.lookups.clear()])
  })
}

/** Data that travels in backups and sync. Book text and PDFs stay on each device. */
const syncedTables = [
  'progress',
  'settings',
  'plan',
  'focusLog',
  'books',
  'highlights',
  'userConcepts',
  'lookups',
  'attempts',
  'focusRecords',
  'drawings',
] as const
type SyncedTable = (typeof syncedTables)[number]

export type Snapshot = {
  app: 'vector'
  version: 4
  exportedAt: string
  note: string
} & Record<SyncedTable, unknown[]>

export async function exportSnapshot(): Promise<Snapshot> {
  const tables = await Promise.all(syncedTables.map((t) => db.table(t).toArray()))
  const data = Object.fromEntries(syncedTables.map((t, i) => [t, tables[i] ?? []])) as Record<
    SyncedTable,
    unknown[]
  >
  // Never export secrets: the AI key and the sync passphrase stay on this device.
  data.settings = (data.settings as SettingsRow[]).map(({ ai, sync, ...rest }) => ({
    ...rest,
    ai: ai && { model: ai.model },
    ...(sync ? { sync: { url: sync.url } } : {}),
  }))
  return {
    app: 'vector',
    version: 4,
    exportedAt: new Date().toISOString(),
    note: 'Il testo dei libri importati non è incluso: si ricollega dal PDF su ogni dispositivo.',
    ...data,
  }
}

export async function exportAll(): Promise<string> {
  return JSON.stringify(await exportSnapshot(), null, 2)
}

export class SnapshotError extends Error {}

/** Replaces local data with a snapshot. Keeps this device's secrets and book texts. */
export async function importSnapshot(raw: unknown): Promise<void> {
  const snap = raw as Partial<Snapshot> | null
  if (snap?.app !== 'vector' || typeof snap.version !== 'number' || snap.version > 4)
    throw new SnapshotError('Non è un backup di Vector, o è di una versione più recente.')
  for (const t of syncedTables) {
    const rows = snap[t]
    if (rows !== undefined && !Array.isArray(rows))
      throw new SnapshotError(`Dati non validi: ${t}.`)
  }
  const local = await db.settings.get('settings')
  await db.transaction(
    'rw',
    [...syncedTables.map((t) => db.table(t)), db.bookPages, db.bookFiles],
    async () => {
      for (const t of syncedTables) {
        await db.table(t).clear()
        const rows = (snap[t] ?? []) as object[]
        if (t === 'settings') {
          const incoming = rows[0] as SettingsRow | undefined
          if (incoming)
            await db.settings.put({
              ...incoming,
              id: 'settings',
              ai: {
                ...incoming.ai,
                apiKey: local?.ai?.apiKey ?? null,
                model: incoming.ai?.model ?? local?.ai?.model ?? DEFAULT_MODEL,
              },
              ...(local?.sync ? { sync: local.sync } : {}),
            })
          else if (local) await db.settings.put(local)
        } else if (rows.length > 0) {
          await db.table(t).bulkPut(rows)
        }
      }
      // Book texts of books no longer present are removed.
      const keep = new Set(((snap.books ?? []) as Book[]).map((b) => b.id))
      await db.bookPages.filter((p) => !keep.has(p.bookId)).delete()
      await db.bookFiles.filter((f) => !keep.has(f.id)).delete()
    },
  )
}

/** Book ids whose text is on this device. */
export async function booksWithText(): Promise<Set<string>> {
  return new Set((await db.bookPages.orderBy('bookId').uniqueKeys()) as string[])
}

/** Attaches the text (and file) of an already known book on this device. */
export async function relinkBook(book: Book, pages: string[], file: Blob | null): Promise<void> {
  await db.transaction('rw', db.books, db.bookPages, db.bookFiles, async () => {
    await db.bookPages.where('bookId').equals(book.id).delete()
    await db.bookPages.bulkPut(pages.map((text, i) => ({ bookId: book.id, page: i + 1, text })))
    if (file) await db.bookFiles.put({ id: book.id, blob: file })
    await db.books.put(book)
  })
}

export async function resetAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
