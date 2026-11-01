import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { UserConcept } from '../core/ai/questions'
import { buildCourse } from '../core/content/course'
import { pplSample } from '../core/content/ppl-sample'
import type { Course } from '../core/content/types'
import type { PlanItem } from '../core/plan'
import { type Pomodoro, phaseLabel, tick } from '../core/pomodoro'
import { type AnswerRecord, applyAnswer, type ConceptProgress, flagVariant } from '../core/progress'
import type { Book } from '../core/reading/book'
import { createSrs, type Srs } from '../core/scheduler'
import type { Session } from '../core/session'
import { notify } from './alerts'
import {
  type Attempt,
  addAttempt,
  addFocusEntry,
  deleteBook,
  deletePlanItem,
  deleteUserConcept,
  type FocusEntry,
  loadActiveSession,
  loadBooks,
  loadFocusLog,
  loadPlan,
  loadPomodoro,
  loadPreferences,
  loadProgress,
  loadUserConcepts,
  type Preferences,
  resetAll,
  saveActiveSession,
  saveBook,
  savePlanItems,
  savePomodoro,
  savePreferences,
  saveProgress,
  saveUserConcepts,
} from './data/db'

interface Store {
  course: Course
  prefs: Preferences
  progress: ReadonlyMap<string, ConceptProgress>
  activeSession: Session | null
  srs: Srs
  updatePrefs: (p: Preferences) => Promise<void>
  recordAnswer: (conceptId: string, answer: AnswerRecord) => void
  flag: (conceptId: string, variantId: string) => void
  setActiveSession: (s: Session | null) => void
  reset: () => Promise<void>
  reload: () => Promise<void>
  plan: readonly PlanItem[]
  savePlan: (items: PlanItem[]) => void
  removePlan: (id: string) => void
  pomodoro: Pomodoro | null
  setPomodoro: (p: Pomodoro | null) => void
  focusLog: readonly FocusEntry[]
  books: readonly Book[]
  putBook: (b: Book) => void
  removeBook: (id: string) => Promise<void>
  userConcepts: readonly UserConcept[]
  addConcepts: (c: UserConcept[]) => void
  removeConcept: (id: string) => void
  logAttempt: (a: Attempt) => void
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside <StoreProvider>')
  return store
}

interface Loaded {
  prefs: Preferences
  progress: Map<string, ConceptProgress>
  activeSession: Session | null
  srs: Srs
  plan: PlanItem[]
  pomodoro: Pomodoro | null
  focusLog: FocusEntry[]
  books: Book[]
  userConcepts: UserConcept[]
}

async function loadState(): Promise<Loaded> {
  const [prefs, progress, activeSession, srs, plan, pomodoro, focusLog, books, userConcepts] =
    await Promise.all([
      loadPreferences(),
      loadProgress(),
      loadActiveSession(),
      createSrs(),
      loadPlan(),
      loadPomodoro(),
      loadFocusLog(),
      loadBooks(),
      loadUserConcepts(),
    ])
  return { prefs, progress, activeSession, srs, plan, pomodoro, focusLog, books, userConcepts }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadState()
      .then(setLoaded)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  /** Reads everything again from storage, after an import or a sync. */
  const reload = useCallback(async () => setLoaded(await loadState()), [])

  const updatePrefs = useCallback(async (prefs: Preferences) => {
    // Optimistic: the screen updates at once, the write follows.
    setLoaded((l) => (l ? { ...l, prefs } : l))
    await savePreferences(prefs)
  }, [])

  const recordAnswer = useCallback((conceptId: string, answer: AnswerRecord) => {
    setLoaded((l) => {
      if (!l) return l
      const next = applyAnswer(l.progress.get(conceptId), conceptId, answer, l.srs, new Date())
      void saveProgress(next)
      return { ...l, progress: new Map(l.progress).set(conceptId, next) }
    })
  }, [])

  const flag = useCallback((conceptId: string, variantId: string) => {
    setLoaded((l) => {
      if (!l) return l
      const next = flagVariant(l.progress.get(conceptId), conceptId, variantId)
      void saveProgress(next)
      return { ...l, progress: new Map(l.progress).set(conceptId, next) }
    })
  }, [])

  const setActiveSession = useCallback((activeSession: Session | null) => {
    void saveActiveSession(activeSession)
    setLoaded((l) => (l ? { ...l, activeSession } : l))
  }, [])

  const reset = useCallback(async () => {
    await resetAll()
    const prefs = await loadPreferences()
    setLoaded((l) =>
      l
        ? {
            ...l,
            prefs,
            progress: new Map(),
            activeSession: null,
            plan: [],
            pomodoro: null,
            focusLog: [],
            books: [],
            userConcepts: [],
          }
        : l,
    )
  }, [])

  const putBook = useCallback((book: Book) => {
    void saveBook(book)
    setLoaded((l) => (l ? { ...l, books: [...l.books.filter((b) => b.id !== book.id), book] } : l))
  }, [])

  const removeBook = useCallback(async (id: string) => {
    await deleteBook(id)
    setLoaded((l) => (l ? { ...l, books: l.books.filter((b) => b.id !== id) } : l))
  }, [])

  const addConcepts = useCallback((concepts: UserConcept[]) => {
    void saveUserConcepts(concepts)
    setLoaded((l) => (l ? { ...l, userConcepts: [...l.userConcepts, ...concepts] } : l))
  }, [])

  const removeConcept = useCallback((id: string) => {
    void deleteUserConcept(id)
    setLoaded((l) => (l ? { ...l, userConcepts: l.userConcepts.filter((c) => c.id !== id) } : l))
  }, [])

  const logAttempt = useCallback((a: Attempt) => {
    void addAttempt(a)
  }, [])

  const course = useMemo(
    () =>
      loaded
        ? buildCourse(pplSample, loaded.userConcepts, loaded.prefs.study.includeSample)
        : pplSample,
    [loaded],
  )

  const savePlan = useCallback((items: PlanItem[]) => {
    void savePlanItems(items)
    setLoaded((l) => {
      if (!l) return l
      const byId = new Map(l.plan.map((i) => [i.id, i]))
      for (const i of items) byId.set(i.id, i)
      return { ...l, plan: [...byId.values()].sort((a, b) => a.start.localeCompare(b.start)) }
    })
  }, [])

  const removePlan = useCallback((id: string) => {
    void deletePlanItem(id)
    setLoaded((l) => (l ? { ...l, plan: l.plan.filter((i) => i.id !== id) } : l))
  }, [])

  const setPomodoro = useCallback((pomodoro: Pomodoro | null) => {
    void savePomodoro(pomodoro)
    setLoaded((l) => (l ? { ...l, pomodoro } : l))
  }, [])

  // The pomodoro keeps running on every screen. Only a phase change re-renders the app.
  const latest = useRef(loaded)
  latest.current = loaded
  useEffect(() => {
    const id = setInterval(() => {
      const l = latest.current
      if (!l?.pomodoro) return
      const { state, finished } = tick(l.pomodoro, Date.now(), l.prefs.config.pomodoro)
      if (!finished) return
      setPomodoro(state)
      notify(`${phaseLabel[finished]} finita`, `Ora: ${phaseLabel[state.phase].toLowerCase()}.`)
      if (finished === 'focus') {
        const entry: FocusEntry = {
          id: crypto.randomUUID(),
          endedAt: new Date().toISOString(),
          minutes: l.prefs.config.pomodoro.focusMinutes,
        }
        void addFocusEntry(entry)
        setLoaded((x) => (x ? { ...x, focusLog: [...x.focusLog, entry] } : x))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [setPomodoro])

  const value = useMemo<Store | null>(
    () =>
      loaded && {
        course,
        ...loaded,
        updatePrefs,
        recordAnswer,
        flag,
        setActiveSession,
        reset,
        reload,
        savePlan,
        removePlan,
        setPomodoro,
        putBook,
        removeBook,
        addConcepts,
        removeConcept,
        logAttempt,
      },
    [
      loaded,
      course,
      putBook,
      removeBook,
      addConcepts,
      removeConcept,
      logAttempt,
      updatePrefs,
      recordAnswer,
      flag,
      setActiveSession,
      reset,
      reload,
      savePlan,
      removePlan,
      setPomodoro,
    ],
  )

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <p role="alert">Non riesco ad aprire i dati locali: {error}</p>
      </main>
    )
  }
  if (!value) return null
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
