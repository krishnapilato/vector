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
import { pplSample } from '../core/content/ppl-sample'
import type { Course } from '../core/content/types'
import type { PlanItem } from '../core/plan'
import { type Pomodoro, phaseLabel, tick } from '../core/pomodoro'
import { type AnswerRecord, applyAnswer, type ConceptProgress, flagVariant } from '../core/progress'
import { createSrs, type Srs } from '../core/scheduler'
import type { Session } from '../core/session'
import { notify } from './alerts'
import {
  addFocusEntry,
  deletePlanItem,
  type FocusEntry,
  loadActiveSession,
  loadFocusLog,
  loadPlan,
  loadPomodoro,
  loadPreferences,
  loadProgress,
  type Preferences,
  resetAll,
  saveActiveSession,
  savePlanItems,
  savePomodoro,
  savePreferences,
  saveProgress,
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
  plan: readonly PlanItem[]
  savePlan: (items: PlanItem[]) => void
  removePlan: (id: string) => void
  pomodoro: Pomodoro | null
  setPomodoro: (p: Pomodoro | null) => void
  focusLog: readonly FocusEntry[]
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
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      loadPreferences(),
      loadProgress(),
      loadActiveSession(),
      createSrs(),
      loadPlan(),
      loadPomodoro(),
      loadFocusLog(),
    ])
      .then(([prefs, progress, activeSession, srs, plan, pomodoro, focusLog]) =>
        setLoaded({ prefs, progress, activeSession, srs, plan, pomodoro, focusLog }),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

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
          }
        : l,
    )
  }, [])

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
        course: pplSample,
        ...loaded,
        updatePrefs,
        recordAnswer,
        flag,
        setActiveSession,
        reset,
        savePlan,
        removePlan,
        setPomodoro,
      },
    [
      loaded,
      updatePrefs,
      recordAnswer,
      flag,
      setActiveSession,
      reset,
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
