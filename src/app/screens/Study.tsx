import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { buildExplainPrompt, type ExplainInput } from '../../core/ai/prompt'
import { minReadSeconds } from '../../core/content/question'
import { distractionLabel } from '../../core/focus/focus'
import { type Confidence, type Graded, grade, verdictLabel } from '../../core/grading'
import { remainingFraction, timeLimitFor } from '../../core/question-timer'
import { createRng, randomSeed } from '../../core/random'
import {
  addInterruption,
  advance,
  buildSession,
  currentItem,
  isFinished,
  recordResult,
  type Session,
  summarize,
} from '../../core/session'
import { AiError, generate } from '../ai/gemini'
import { FocusLine, type FocusView, useFocus } from '../focus/useFocus'
import { hrefFor, navigate } from '../router'
import { useStore } from '../state'
import { LinkButton, PrimaryButton, QuietButton, QuietLink } from '../ui'

const ToolsPanel = lazy(() => import('./ToolsPanel').then((m) => ({ default: m.ToolsPanel })))

type Phase = 'think' | 'answer' | 'confidence' | 'why' | 'feedback'

const confidenceOptions: { value: Confidence; label: string }[] = [
  { value: 'sure', label: 'Sicuro' },
  { value: 'unsure', label: 'Incerto' },
  { value: 'guess', label: 'A caso' },
]

function exitFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}

export function Study({ subjectId, early }: { subjectId: string | null; early: boolean }) {
  const store = useStore()
  const rng = useRef(createRng(randomSeed())).current

  const [session, setSession] = useState<Session | null>(() => {
    if (store.activeSession && !isFinished(store.activeSession)) return store.activeSession
    return buildSession({
      course: store.course,
      progress: store.progress,
      settings: store.prefs.study,
      config: store.prefs.config,
      rng,
      now: new Date(),
      id: crypto.randomUUID(),
      subjectId,
      early,
    })
  })

  const { setActiveSession } = store
  useEffect(() => {
    if (session) setActiveSession(isFinished(session) ? null : session)
  }, [session, setActiveSession])

  const fullscreen = store.prefs.study.fullscreen
  useEffect(() => {
    if (fullscreen && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {})
    }
    return exitFullscreen
  }, [fullscreen])

  const focus = useFocus(session !== null && !isFinished(session), 'study')

  if (!session) {
    return (
      <Centered>
        <p className="text-lg">Niente da ripassare adesso.</p>
        <div className="flex flex-wrap items-center gap-6">
          <LinkButton href={hrefFor({ name: 'study', subjectId, early: true })}>
            Allenati comunque
          </LinkButton>
          <QuietLink href="#/">Torna all'inizio</QuietLink>
        </div>
      </Centered>
    )
  }

  if (isFinished(session)) return <SessionEnd session={session} />

  return <Question session={session} setSession={setSession} rngSeed={rng} focus={focus} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6">
      {children}
    </main>
  )
}

function SessionEnd({ session }: { session: Session }) {
  const { course } = useStore()
  const s = summarize(session, course)
  useEffect(exitFullscreen, [])
  return (
    <Centered>
      <h1 className="text-3xl font-medium tracking-tight">Sessione finita.</h1>
      <p className="text-lg">
        {s.known} su {s.total} {s.total === 1 ? 'concetto saputo' : 'concetti saputi'}.
      </p>
      {s.toReview.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--fg-quiet)]">Da rivedere nelle materie:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {s.toReview.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {s.interruptions > 0 && (
        <p className="text-sm text-[var(--fg-quiet)]">
          Sei uscito dall'app {s.interruptions} {s.interruptions === 1 ? 'volta' : 'volte'}.
        </p>
      )}
      <div>
        <LinkButton href="#/">Fine</LinkButton>
      </div>
    </Centered>
  )
}

interface QuestionProps {
  session: Session
  setSession: (s: Session) => void
  rngSeed: () => number
  focus: FocusView
}

function Question({ session, setSession, rngSeed, focus }: QuestionProps) {
  const store = useStore()
  const { config } = store.prefs
  const item = currentItem(session)
  if (!item) throw new Error('No current question')
  const q = item.question
  const concept = store.course.concepts.find((c) => c.id === q.conceptId)
  const limit = timeLimitFor(q.kind, config, session.mode)
  const thinkFirst = q.kind === 'recall' && config.quiz.thinkFirstSeconds > 0

  const [phase, setPhase] = useState<Phase>(thinkFirst ? 'think' : 'answer')
  const [chosen, setChosen] = useState<string | null>(null)
  const [graded, setGraded] = useState<Graded | null>(null)
  const [reported, setReported] = useState(false)
  const [paused, setPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState('sei uscito dall’app')
  // Tools never pause the timer: they are part of studying.
  const [toolsOpen, setToolsOpen] = useState(false)

  // Time: counted only while the app is visible.
  const startedAt = useRef(performance.now())
  const spent = useRef(0)
  const pausedRef = useRef(false)
  const [, tick] = useState(0)
  const elapsed = useCallback(
    () => spent.current + (pausedRef.current ? 0 : (performance.now() - startedAt.current) / 1000),
    [],
  )
  const running = phase === 'think' || phase === 'answer'

  useEffect(() => {
    if (!running || paused) return
    const id = setInterval(() => tick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [running, paused])

  const latest = useRef(session)
  latest.current = session

  const pause = useCallback(
    (reason: string) => {
      if (pausedRef.current) return
      spent.current += (performance.now() - startedAt.current) / 1000
      pausedRef.current = true
      setPauseReason(reason)
      setPaused(true)
      if (running) setSession(addInterruption(latest.current))
    },
    [running, setSession],
  )

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause('sei uscito dall’app')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause])

  // Camera: away from the desk, phone in hand or eyes closed for too long.
  useEffect(() => {
    if (focus.shouldPause && focus.distraction && focus.distraction !== 'left')
      pause(distractionLabel[focus.distraction].toLowerCase())
  }, [focus.shouldPause, focus.distraction, pause])

  const resume = useCallback(() => {
    startedAt.current = performance.now()
    pausedRef.current = false
    setPaused(false)
  }, [])

  const finalize = useCallback(
    (picked: string | null, confidence: Confidence | null, why: string | null) => {
      const secs = elapsed()
      const result = grade({
        correct: picked === null ? null : picked === q.correctOptionId,
        confidence,
        whyCorrect: why === null || !q.why ? null : why === q.why.correctOptionId,
        elapsedSeconds: secs,
        minReadSeconds: minReadSeconds(q),
        seenBefore: item.seenBefore,
      })
      setGraded(result)
      setPhase('feedback')
      setSession(
        recordResult(
          latest.current,
          {
            chosenOptionId: picked,
            confidence,
            whyOptionId: why,
            elapsedSeconds: Math.round(secs * 10) / 10,
            verdict: result.verdict,
          },
          result.counts,
          { course: store.course, progress: store.progress, rng: rngSeed, config },
        ),
      )
      store.recordAnswer(q.conceptId, {
        variantId: q.variantId,
        generated: q.generated,
        seenBefore: item.seenBefore,
        graded: result,
        updatesSchedule: item.attempt === 1,
      })
      store.logAttempt({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        conceptId: q.conceptId,
        variantId: q.variantId,
        verdict: result.verdict,
        prompt: q.prompt,
        chosen: q.options.find((o) => o.id === picked)?.text ?? null,
        correct: q.options.find((o) => o.id === q.correctOptionId)?.text ?? '',
        elapsedSeconds: Math.round(secs * 10) / 10,
        seenBefore: item.seenBefore,
      })
    },
    [q, item, store, config, rngSeed, setSession, elapsed],
  )

  const [confidence, setConfidence] = useState<Confidence | null>(null)

  const choose = (optionId: string) => {
    setChosen(optionId)
    setPhase('confidence')
  }
  const dontKnow = () => finalize(null, null, null)
  const pickConfidence = (c: Confidence) => {
    setConfidence(c)
    const correct = chosen === q.correctOptionId
    if (correct && c !== 'guess' && q.why) setPhase('why')
    else finalize(chosen, c, null)
  }
  const pickWhy = (optionId: string) => finalize(chosen, confidence, optionId)
  const next = () => setSession(advance(latest.current))
  const exit = () => {
    exitFullscreen()
    navigate({ name: 'home' })
  }

  // Auto-reveal after the "think first" pause, and time-outs.
  const secs = elapsed()
  useEffect(() => {
    if (paused) return
    if (phase === 'think' && secs >= config.quiz.thinkFirstSeconds) setPhase('answer')
    if (running && limit !== null && secs >= limit) finalize(null, null, null)
  }, [secs, phase, paused, running, limit, config.quiz.thinkFirstSeconds, finalize])

  // Keyboard: 1–4 answer, 0 "don't know", Space/Enter continue, Esc exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (paused) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          resume()
        }
        return
      }
      if (toolsOpen) {
        if (e.key === 'Escape') setToolsOpen(false)
        return
      }
      const target = e.target as HTMLElement | null
      if (target?.closest('input, select, textarea')) return
      if (e.key === 'Escape') return exit()
      if (phase === 'think' && e.key === ' ') {
        e.preventDefault()
        setPhase('answer')
      } else if (phase === 'answer' && n >= 1 && n <= q.options.length) {
        choose(q.options[n - 1]?.id as string)
      } else if (phase === 'answer' && e.key === '0') {
        dontKnow()
      } else if (phase === 'confidence' && n >= 1 && n <= 3) {
        pickConfidence(confidenceOptions[n - 1]?.value as Confidence)
      } else if (phase === 'why' && q.why && n >= 1 && n <= q.why.options.length) {
        pickWhy(q.why.options[n - 1]?.id as string)
      } else if (phase === 'feedback' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const progressDone = session.index / session.items.length
  const optionText = (id: string | null) => q.options.find((o) => o.id === id)?.text

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-px bg-[var(--rule)]" aria-hidden="true">
        <div className="h-px bg-[var(--fg)]" style={{ width: `${progressDone * 100}%` }} />
      </div>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-end gap-1 px-6 pt-3">
        <div className="mr-auto">
          <FocusLine view={focus} />
        </div>
        <QuietButton onClick={() => setToolsOpen((o) => !o)} aria-expanded={toolsOpen}>
          Strumenti
        </QuietButton>
        <QuietButton onClick={exit} aria-label="Esci e salva la sessione">
          Esci
        </QuietButton>
      </header>
      {toolsOpen && (
        <Suspense fallback={null}>
          <ToolsPanel onClose={() => setToolsOpen(false)} />
        </Suspense>
      )}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-between gap-10 px-6 pb-10 pt-6">
        <div className="flex flex-col gap-6">
          <p className="text-xs text-[var(--fg-quiet)]">{concept?.title}</p>
          <h1 className="text-2xl leading-snug">{q.prompt}</h1>
          {limit !== null && running && (
            <div className="h-px w-full bg-[var(--rule)]" aria-hidden="true">
              <div
                className="h-px bg-[var(--fg-quiet)]"
                style={{ width: `${remainingFraction(secs, limit) * 100}%` }}
              />
            </div>
          )}
        </div>

        {paused ? (
          <div className="flex flex-col items-start gap-4" role="alert">
            <p className="text-lg">In pausa: {pauseReason}.</p>
            <PrimaryButton onClick={resume}>Continua</PrimaryButton>
          </div>
        ) : phase === 'think' ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-[var(--fg-quiet)]">
              Pensa alla risposta prima di vedere le opzioni.
            </p>
            <PrimaryButton onClick={() => setPhase('answer')}>Mostra le opzioni</PrimaryButton>
          </div>
        ) : phase === 'answer' ? (
          <div className="flex flex-col gap-3">
            {q.options.map((o, i) => (
              <ChoiceButton key={o.id} index={i + 1} onClick={() => choose(o.id)}>
                {o.text}
              </ChoiceButton>
            ))}
            <QuietButton className="self-start" onClick={dontKnow}>
              Non lo so (0)
            </QuietButton>
          </div>
        ) : phase === 'confidence' ? (
          <div className="flex flex-col gap-3">
            <p className="text-[var(--fg-quiet)]">
              Hai scelto: <span className="text-[var(--fg)]">{optionText(chosen)}</span>. Quanto ne
              sei sicuro?
            </p>
            {confidenceOptions.map((c, i) => (
              <ChoiceButton key={c.value} index={i + 1} onClick={() => pickConfidence(c.value)}>
                {c.label}
              </ChoiceButton>
            ))}
          </div>
        ) : phase === 'why' && q.why ? (
          <div className="flex flex-col gap-3">
            <p className="text-[var(--fg-quiet)]">Perché?</p>
            {q.why.options.map((o, i) => (
              <ChoiceButton key={o.id} index={i + 1} onClick={() => pickWhy(o.id)}>
                {o.text}
              </ChoiceButton>
            ))}
          </div>
        ) : (
          graded && (
            <div className="flex flex-col gap-6" aria-live="polite">
              <p className="text-xl font-medium">{verdictLabel[graded.verdict]}</p>
              <dl className="flex flex-col gap-2">
                {chosen && chosen !== q.correctOptionId && (
                  <div>
                    <dt className="text-xs text-[var(--fg-quiet)]">La tua risposta</dt>
                    <dd className="line-through">{optionText(chosen)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-[var(--fg-quiet)]">Risposta corretta</dt>
                  <dd className="font-medium">{optionText(q.correctOptionId)}</dd>
                </div>
              </dl>
              <p className="leading-relaxed">{q.explanation}</p>
              {!graded.counts && concept && (
                <blockquote className="border-l border-[var(--fg)] pl-4">
                  <p className="text-xs text-[var(--fg-quiet)]">Dal testo · {concept.title}</p>
                  <p className="mt-2 leading-relaxed">{concept.source}</p>
                  <p className="mt-2 text-xs text-[var(--fg-quiet)]">
                    Lo rivedrai tra qualche domanda, con parole diverse.
                  </p>
                </blockquote>
              )}
              {concept && (
                <ExplainAgain
                  key={`${session.index}`}
                  input={{
                    conceptTitle: concept.title,
                    source: concept.source,
                    question: q.prompt,
                    correctAnswer: optionText(q.correctOptionId) ?? '',
                    chosenAnswer: optionText(chosen) ?? null,
                    mistake: verdictLabel[graded.verdict],
                  }}
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <PrimaryButton onClick={next} autoFocus>
                  Avanti
                </PrimaryButton>
                {!q.generated &&
                  (reported ? (
                    <span className="text-sm text-[var(--fg-quiet)]">
                      Segnalata: non te la riproporrò.
                    </span>
                  ) : (
                    <QuietButton
                      onClick={() => {
                        store.flag(q.conceptId, q.variantId)
                        setReported(true)
                      }}
                    >
                      Questa domanda è sbagliata
                    </QuietButton>
                  ))}
              </div>
            </div>
          )
        )}
      </main>
    </div>
  )
}

/** Optional: a different explanation from Gemini, only on request and only with the learner's key. */
function ExplainAgain({ input }: { input: ExplainInput }) {
  const { prefs, course } = useStore()
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'done'; text: string }
    | { kind: 'error'; text: string }
  >({ kind: 'idle' })
  const apiKey = prefs.ai.apiKey
  if (!apiKey) return null

  const ask = async () => {
    setState({ kind: 'loading' })
    try {
      let hints: string[] = []
      if (prefs.study.personalize) {
        const [{ buildProfile, profileHints }, db] = await Promise.all([
          import('../../core/profile'),
          import('../data/db'),
        ])
        const [attempts, focus, lookups] = await Promise.all([
          db.loadAttempts(),
          db.loadFocusRecords(),
          db.loadLookups(),
        ])
        hints = profileHints(buildProfile(attempts, focus, lookups, course))
      }
      const text = await generate(apiKey, prefs.ai.model, buildExplainPrompt({ ...input, hints }))
      setState({ kind: 'done', text })
    } catch (e) {
      setState({
        kind: 'error',
        text: e instanceof AiError ? e.message : 'Qualcosa non ha funzionato.',
      })
    }
  }

  if (state.kind === 'idle') {
    return (
      <QuietButton className="self-start" onClick={ask}>
        Spiegamelo in un altro modo
      </QuietButton>
    )
  }
  return (
    <div className="flex flex-col gap-2 border-l border-[var(--rule)] pl-4" aria-live="polite">
      <p className="text-xs text-[var(--fg-quiet)]">
        Spiegazione generata dall'AI · verificala con il testo
      </p>
      {state.kind === 'loading' && (
        <p className="text-[var(--fg-quiet)]">Sto preparando una spiegazione…</p>
      )}
      {state.kind === 'done' && <p className="whitespace-pre-line leading-relaxed">{state.text}</p>}
      {state.kind === 'error' && <p role="alert">{state.text}</p>}
    </div>
  )
}

function ChoiceButton({
  index,
  onClick,
  children,
}: {
  index: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-choice={index}
      onClick={onClick}
      className="flex min-h-12 w-full items-start gap-4 rounded-lg border border-[var(--rule)] px-4 py-3 text-left hover:border-[var(--fg)]"
    >
      <span className="w-3 text-sm tabular-nums text-[var(--fg-quiet)]" aria-hidden="true">
        {index}
      </span>
      <span>{children}</span>
    </button>
  )
}
