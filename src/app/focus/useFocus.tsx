import { useEffect, useRef, useState } from 'react'
import {
  type Distraction,
  distractionLabel,
  type FocusRules,
  type FocusState,
  focusScore,
  startFocus,
  step,
  summarize,
  visibleDistraction,
} from '../../core/focus/focus'
import { beep } from '../alerts'
import { addFocusRecord } from '../data/db'
import { t } from '../i18n'
import { useStore } from '../state'
import type { Sensors } from './sensors'

export interface FocusView {
  /** null until the first second of tracking. */
  score: number | null
  distraction: Distraction | null
  shouldPause: boolean
  sensors: 'off' | 'starting' | 'on' | 'error'
  error: string | null
}

/**
 * Tracks attention while `active`. Tab changes are always counted; camera and
 * microphone only if the learner turned them on. Saves one record of numbers per use.
 */
export function useFocus(active: boolean, kind: 'study' | 'reading'): FocusView {
  const { prefs } = useStore()
  const settings = prefs.focus
  const rules: FocusRules = {
    ignoreSeconds: prefs.config.focus.ignoreDistractionSeconds,
    pauseAfterSeconds: prefs.config.focus.pauseAfterSeconds,
    aloud: settings.aloud,
  }
  const rulesRef = useRef(rules)
  rulesRef.current = rules
  const [view, setView] = useState<FocusView>({
    score: null,
    distraction: null,
    shouldPause: false,
    sensors: settings.camera || settings.mic ? 'starting' : 'off',
    error: null,
  })
  const wantCamera = settings.camera
  const wantMic = settings.mic
  const wantPhone = settings.phone
  const sound = settings.sound

  useEffect(() => {
    if (!active) return
    let sensors: Sensors | null = null
    let cancelled = false
    const t0 = performance.now()
    let state: FocusState = startFocus(0)
    let lastShown: Distraction | null = null

    if (wantCamera || wantMic) {
      setView((v) => ({ ...v, sensors: 'starting', error: null }))
      void import('./sensors')
        .then((m) => m.startSensors({ camera: wantCamera, mic: wantMic, phone: wantPhone }))
        .then((s) => {
          if (cancelled) s.stop()
          else {
            sensors = s
            setView((v) => ({ ...v, sensors: 'on' }))
          }
        })
        .catch((e: unknown) => {
          if (cancelled) return
          const denied = e instanceof DOMException && e.name === 'NotAllowedError'
          setView((v) => ({
            ...v,
            sensors: 'error',
            error: denied
              ? t('Permesso negato per fotocamera o microfono: la sessione continua senza.')
              : t('Non riesco ad avviare fotocamera o microfono: la sessione continua senza.'),
          }))
        })
    }

    const id = window.setInterval(() => {
      const r = sensors?.read()
      state = step(
        state,
        {
          t: (performance.now() - t0) / 1000,
          hidden: document.hidden,
          face: r?.face ?? null,
          lookingAway: r?.lookingAway ?? false,
          eyesClosed: r?.eyesClosed ?? false,
          phone: r?.phone ?? false,
          voice: r?.voice ?? null,
          mouthMoving: r?.mouthMoving ?? false,
        },
        rulesRef.current,
      )
      const distraction = visibleDistraction(state, rulesRef.current)
      if (distraction && distraction !== lastShown && sound && distraction !== 'left') beep()
      lastShown = distraction
      setView((v) =>
        v.distraction === distraction &&
        v.shouldPause === state.shouldPause &&
        v.score !== null &&
        Math.abs((v.score ?? 0) - focusScore(state)) < 0.01
          ? v
          : { ...v, distraction, shouldPause: state.shouldPause, score: focusScore(state) },
      )
    }, 500)

    return () => {
      cancelled = true
      window.clearInterval(id)
      sensors?.stop()
      const summary = summarize(state)
      if (summary.seconds >= 30) {
        void addFocusRecord({
          id: crypto.randomUUID(),
          endedAt: new Date().toISOString(),
          kind,
          sensors: { camera: wantCamera, mic: wantMic },
          ...summary,
        })
      }
    }
  }, [active, kind, wantCamera, wantMic, wantPhone, sound])

  return view
}

/** One quiet line: the score and, only when it matters, what is distracting. */
export function FocusLine({ view }: { view: FocusView }) {
  if (view.error) return <p className="text-xs text-[var(--fg-quiet)]">{view.error}</p>
  if (view.score === null) return null
  return (
    <p className="text-xs text-[var(--fg-quiet)]" aria-live="polite">
      {t('Attenzione')} {Math.round(view.score * 100)}%
      {view.sensors === 'starting' ? t(' · avvio i sensori…') : ''}
      {view.distraction ? (
        <span className="text-[var(--fg)]"> · {t(distractionLabel[view.distraction])}</span>
      ) : null}
    </p>
  )
}
