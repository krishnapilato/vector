import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { pplSample } from '../core/content/ppl-sample'
import type { Course } from '../core/content/types'
import { type AnswerRecord, applyAnswer, type ConceptProgress, flagVariant } from '../core/progress'
import { createSrs, type Srs } from '../core/scheduler'
import type { Session } from '../core/session'
import {
  loadActiveSession,
  loadPreferences,
  loadProgress,
  type Preferences,
  resetAll,
  saveActiveSession,
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
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadPreferences(), loadProgress(), loadActiveSession(), createSrs()])
      .then(([prefs, progress, activeSession, srs]) =>
        setLoaded({ prefs, progress, activeSession, srs }),
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
    setLoaded((l) => (l ? { ...l, prefs, progress: new Map(), activeSession: null } : l))
  }, [])

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
      },
    [loaded, updatePrefs, recordAnswer, flag, setActiveSession, reset],
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
