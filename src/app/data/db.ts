import Dexie, { type EntityTable } from 'dexie'
import { type Config, configSchema, defaultConfig } from '../../config/config'
import type { UserConcept } from '../../core/ai/questions'
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
export async function exportAll(): Promise<string> {
  const [progress, rows, plan, focusLog, books, highlights, userConcepts, attempts, focusRecords] =
    await Promise.all([
      db.progress.toArray(),
      db.settings.toArray(),
      db.plan.toArray(),
      db.focusLog.toArray(),
      db.books.toArray(),
      db.highlights.toArray(),
      db.userConcepts.toArray(),
      db.attempts.toArray(),
      db.focusRecords.toArray(),
    ])
  // Never export the API key.
  const settings = rows.map(({ ai, ...rest }) => ({ ...rest, ai: ai && { model: ai.model } }))
  return JSON.stringify(
    {
      app: 'vector',
      version: 3,
      exportedAt: new Date(),
      note: 'Il testo dei libri importati non è incluso: si reimporta dal PDF.',
      progress,
      settings,
      plan,
      focusLog,
      books,
      highlights,
      userConcepts,
      attempts,
      focusRecords,
    },
    null,
    2,
  )
}

export async function resetAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
