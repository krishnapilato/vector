import { useEffect, useId, useState } from 'react'
import type { Concept } from '../../core/content/types'
import { type Graded, verdictLabel } from '../../core/grading'
import {
  buildOpenPrompt,
  gradeOpen,
  keyPointsFor,
  mergeCovered,
  type OpenFeedback,
  openPrompt,
  parseOpenFeedback,
  pickOpenConcept,
} from '../../core/open'
import { masteryOf } from '../../core/progress'
import { createRng, randomSeed } from '../../core/random'
import { AiError, generate } from '../ai/gemini'
import { Dictate } from '../Dictate'
import { FocusLine, useFocus } from '../focus/useFocus'
import { t, tn } from '../i18n'
import { hrefFor, navigate } from '../router'
import { useStore } from '../state'
import { PrimaryButton, QuietButton, QuietLink } from '../ui'

const rng = createRng(randomSeed())
const MAX_ROUNDS = 3

/** Explain a concept in your own words, written or spoken; corrected with hints, not answers. */
export function OpenQuestion({ subjectId }: { subjectId: string | null }) {
  const { course, progress } = useStore()
  const [round, setRound] = useState(0)
  const focus = useFocus(true, 'study')

  const pool = course.concepts.filter((c) => !subjectId || c.subjectId === subjectId)
  const [concept, setConcept] = useState<Concept | null>(() => choose(null))

  function choose(previous: string | null): Concept | null {
    const now = new Date()
    return pickOpenConcept(
      pool,
      (c) => {
        const m = masteryOf(progress.get(c.id), now)
        return m === 'due' ? 4 : m === 'learning' ? 3 : m === 'new' ? 1 : 0.5
      },
      previous,
      rng,
    )
  }

  const exit = () => navigate({ name: 'home' })

  if (!concept) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
        <p className="text-lg">{t('Nessun concetto da spiegare in questa materia.')}</p>
        <QuietLink href="#/">{t('Torna all’inizio')}</QuietLink>
      </main>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-end gap-1 px-6 pt-3">
        <div className="mr-auto">
          <FocusLine view={focus} />
        </div>
        <QuietButton onClick={exit}>{t('Esci')}</QuietButton>
      </header>
      <Explain
        key={`${concept.id}-${round}`}
        concept={concept}
        next={() => {
          setConcept(choose(concept.id) ?? concept)
          setRound((r) => r + 1)
        }}
        exit={exit}
      />
    </div>
  )
}

type Phase =
  | { step: 'answer' }
  | { step: 'checking' }
  | { step: 'feedback'; feedback: OpenFeedback }
  | { step: 'self' }
  | { step: 'done'; graded: Graded }

function Explain({
  concept,
  next,
  exit,
}: {
  concept: Concept
  next: () => void
  exit: () => void
}) {
  const store = useStore()
  const { prefs } = store
  const points = keyPointsFor(concept)
  const [prompt] = useState(() => openPrompt(concept.title, rng, t))
  const [answers, setAnswers] = useState<string[]>([''])
  const [rounds, setRounds] = useState<boolean[][]>([])
  const [phase, setPhase] = useState<Phase>({ step: 'answer' })
  const [error, setError] = useState<string | null>(null)
  const [selfChecked, setSelfChecked] = useState<boolean[]>(() => points.map(() => false))
  const [startedAt] = useState(() => performance.now())
  const [, tick] = useState(0)
  const limit = prefs.config.timers.open
  const id = useId()
  const current = answers[answers.length - 1] ?? ''
  const setCurrent = (text: string) => setAnswers((a) => [...a.slice(0, -1), text])

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const elapsed = (performance.now() - startedAt) / 1000

  const finish = (graded: Graded) => {
    setPhase({ step: 'done', graded })
    store.recordAnswer(concept.id, {
      variantId: 'open',
      generated: true,
      seenBefore: false,
      graded,
      updatesSchedule: true,
    })
    store.logAttempt({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      conceptId: concept.id,
      variantId: 'open',
      verdict: graded.verdict,
      prompt,
      chosen: answers.join('\n').slice(0, 2000),
      correct: points.join(' · '),
      elapsedSeconds: Math.round(elapsed),
      seenBefore: false,
    })
  }

  const check = async () => {
    const apiKey = prefs.ai.apiKey
    if (!apiKey) {
      setPhase({ step: 'self' })
      return
    }
    setPhase({ step: 'checking' })
    setError(null)
    try {
      const raw = await generate(
        apiKey,
        prefs.ai.model,
        buildOpenPrompt({
          exam: store.exam,
          title: concept.title,
          source: concept.source,
          keyPoints: points,
          answer: answers.join('\n'),
          round: answers.length,
        }),
        { json: true, maxOutputTokens: 800, temperature: 0.2 },
      )
      const feedback = parseOpenFeedback(raw, points.length)
      const all = [...rounds, feedback.covered]
      setRounds(all)
      if (mergeCovered(all).every(Boolean) && feedback.mistakes.length === 0) {
        finish(gradeOpen(all, 0))
      } else {
        setPhase({ step: 'feedback', feedback })
      }
    } catch (e) {
      setError(
        e instanceof AiError || e instanceof Error ? e.message : t('Qualcosa non ha funzionato.'),
      )
      setPhase({ step: 'answer' })
    }
  }

  const covered = mergeCovered(rounds)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 pb-10 pt-6">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--fg-quiet)]">
          {t(store.course.subjects.find((s) => s.id === concept.subjectId)?.name ?? '')}{' '}
          {t('· domanda aperta')}
        </p>
        <h1 className="text-2xl leading-snug">{prompt}</h1>
        {phase.step === 'answer' && (
          <p className="text-xs tabular-nums text-[var(--fg-quiet)]">
            {elapsed < limit
              ? t('Prenditi il tempo che serve · consigliati {min} min', {
                  min: Math.round(limit / 60),
                })
              : t('Tempo consigliato superato: chiudi il ragionamento.')}
          </p>
        )}
      </div>

      {answers.length > 1 && (
        <p className="whitespace-pre-line border-l border-[var(--rule)] pl-4 text-[var(--fg-quiet)]">
          {answers.slice(0, -1).join('\n\n')}
        </p>
      )}

      {phase.step === 'feedback' && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <p>
            {tn(
              covered.filter(Boolean).length,
              'Hai centrato {n} punto su {total}.',
              'Hai centrato {n} punti su {total}.',
              {
                total: points.length,
              },
            )}
          </p>
          {phase.feedback.mistakes.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-[var(--fg-quiet)]">{t('Da correggere:')}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {phase.feedback.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {phase.feedback.hint && <p className="text-lg">{phase.feedback.hint}</p>}
          <div className="flex flex-wrap gap-2">
            {answers.length < MAX_ROUNDS && (
              <PrimaryButton
                onClick={() => {
                  setAnswers((a) => [...a, ''])
                  setPhase({ step: 'answer' })
                }}
              >
                {t('Completa la risposta')}
              </PrimaryButton>
            )}
            <QuietButton onClick={() => finish(gradeOpen(rounds, phase.feedback.mistakes.length))}>
              {t('Mostra i punti chiave')}
            </QuietButton>
          </div>
        </section>
      )}

      {(phase.step === 'answer' || phase.step === 'checking') && (
        <section className="flex flex-col gap-3">
          <label htmlFor={id} className="sr-only">
            {t('La tua spiegazione')}
          </label>
          <textarea
            id={id}
            rows={8}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder={
              answers.length > 1
                ? t('Aggiungi quello che manca…')
                : t('Scrivi o detta la tua spiegazione…')
            }
            className="w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] p-4 text-lg leading-relaxed text-[var(--fg)]"
          />
          <Dictate
            lang={store.exam.language === 'en' ? 'en-GB' : 'it-IT'}
            onText={(x) => setCurrent(current ? `${current} ${x}` : x)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton
              onClick={check}
              disabled={current.trim().length < 10 || phase.step === 'checking'}
            >
              {phase.step === 'checking'
                ? t('Controllo…')
                : prefs.ai.apiKey
                  ? t('Correggi')
                  : t('Confronta con i punti chiave')}
            </PrimaryButton>
            <QuietButton onClick={() => finish(gradeOpen([], 0))}>{t('Non lo so')}</QuietButton>
          </div>
          {error && <p role="alert">{error}</p>}
        </section>
      )}

      {phase.step === 'self' && (
        <section className="flex flex-col gap-3">
          <p>{t('Segna con onestà i punti che hai espresso davvero:')}</p>
          {points.map((p, i) => (
            <label key={p} className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-current"
                checked={selfChecked[i] ?? false}
                onChange={(e) =>
                  setSelfChecked((s) => s.map((x, j) => (j === i ? e.target.checked : x)))
                }
              />
              <span>{p}</span>
            </label>
          ))}
          <PrimaryButton className="self-start" onClick={() => finish(gradeOpen([selfChecked], 0))}>
            {t('Fatto')}
          </PrimaryButton>
        </section>
      )}

      {phase.step === 'done' && (
        <section className="flex flex-col gap-4" aria-live="polite">
          <p className="text-lg">{t(verdictLabel[phase.graded.verdict])}</p>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--fg-quiet)]">{t('Punti chiave')}</p>
            <ul className="flex flex-col gap-2">
              {points.map((p, i) => (
                <li key={p} className="flex gap-3">
                  <span aria-hidden="true" className="w-4 text-[var(--fg-quiet)]">
                    {covered[i] || (rounds.length === 0 && selfChecked[i]) ? '✓' : '·'}
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--fg-quiet)]">
              {t('Testo di riferimento')}
            </summary>
            <p className="mt-2 leading-relaxed">{concept.source}</p>
          </details>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={next} autoFocus>
              {t('Un altro concetto')}
            </PrimaryButton>
            <QuietButton onClick={exit}>{t('Fine')}</QuietButton>
            <QuietLink href={hrefFor({ name: 'subjects', subjectId: concept.subjectId })}>
              {t('Rileggi la materia')}
            </QuietLink>
          </div>
        </section>
      )}
    </main>
  )
}
