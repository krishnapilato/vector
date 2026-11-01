import { useEffect, useState } from 'react'
import { nextPlanned, planKindLabel, readiness, sameDay } from '../../core/plan'
import { phaseLabel } from '../../core/pomodoro'
import { masteryOf, scores } from '../../core/progress'
import { isFinished, nextDue, questionsForMinutes } from '../../core/session'
import { loadAttempts } from '../data/db'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { LinkButton, percent, QuietLink } from '../ui'

const dateFmt = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

/** Navigation state: one obvious action, the honest numbers, nothing else. */
export function Home() {
  const { course, progress, activeSession, prefs, plan, pomodoro, focusLog } = useStore()
  const now = new Date()

  const levels = course.concepts.map((c) => masteryOf(progress.get(c.id), now))
  const due = levels.filter((m) => m === 'due').length
  const fresh = Math.min(levels.filter((m) => m === 'new').length, prefs.study.newConcepts)
  const s = scores(progress.values())
  const resume = activeSession && !isFinished(activeSession) ? activeSession : null
  const upcoming = nextDue(course, progress)
  const planned = nextPlanned(plan, now)
  const exam = prefs.plan.examDate ? new Date(`${prefs.plan.examDate}T00:00:00`) : null
  const daysLeft = exam ? readiness(exam, now, 0).daysLeft : null
  const todayMinutes = focusLog
    .filter((e) => sameDay(new Date(e.endedAt), now))
    .reduce((sum, e) => sum + e.minutes, 0)
  const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <h1 className="text-4xl font-medium tracking-tight">Studia i concetti, non le risposte.</h1>

        {resume ? (
          <div className="flex flex-col items-start gap-3">
            <LinkButton
              href={hrefFor({ name: 'study', subjectId: resume.subjectId, early: false })}
            >
              Riprendi da dove eri
            </LinkButton>
            <p className="text-sm text-[var(--fg-quiet)]">
              Domanda {resume.index + 1} di {resume.items.length}
            </p>
          </div>
        ) : due + fresh > 0 ? (
          <div className="flex flex-col items-start gap-3">
            <LinkButton href={hrefFor({ name: 'study', subjectId: null, early: false })}>
              Inizia a studiare
            </LinkButton>
            <p className="text-sm text-[var(--fg-quiet)]">
              {due > 0 && `${due} ${due === 1 ? 'concetto' : 'concetti'} da ripassare`}
              {due > 0 && fresh > 0 && ' · '}
              {fresh > 0 && `${fresh} ${fresh === 1 ? 'nuovo' : 'nuovi'}`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-lg">Sei in pari.</p>
            {upcoming && (
              <p className="text-sm text-[var(--fg-quiet)]">
                Prossimo ripasso: {dateFmt.format(upcoming)}
              </p>
            )}
            <QuietLink href={hrefFor({ name: 'study', subjectId: null, early: true })}>
              Allenati comunque
            </QuietLink>
          </div>
        )}
        {!resume && <FewMinutes />}
        <QuietLink href={hrefFor({ name: 'open', subjectId: null })}>
          Oppure spiega un concetto a parole tue
        </QuietLink>
      </section>

      {(planned || pomodoro || (daysLeft !== null && daysLeft > 0) || todayMinutes > 0) && (
        <section aria-labelledby="today" className="flex flex-col gap-2">
          <h2 id="today" className="text-sm text-[var(--fg-quiet)]">
            Oggi
          </h2>
          <ul className="flex flex-col gap-1">
            {pomodoro && (
              <li>
                <a href={hrefFor({ name: 'pomodoro' })} className="underline underline-offset-4">
                  Pomodoro in corso: {phaseLabel[pomodoro.phase].toLowerCase()}
                </a>
              </li>
            )}
            {planned && (
              <li>
                Prossima sessione: {planKindLabel[planned.kind].toLowerCase()}
                {sameDay(new Date(planned.start), now)
                  ? ` alle ${timeFmt.format(new Date(planned.start))}`
                  : ` ${dateFmt.format(new Date(planned.start))}`}
              </li>
            )}
            {todayMinutes > 0 && <li>{todayMinutes} minuti di concentrazione</li>}
            {daysLeft !== null && daysLeft > 0 && <li>Esame tra {daysLeft} giorni</li>}
          </ul>
        </section>
      )}

      {s.answered > 0 && (
        <section aria-labelledby="scores" className="flex flex-col gap-3">
          <h2 id="scores" className="text-sm text-[var(--fg-quiet)]">
            Come stai andando
          </h2>
          <dl className="grid grid-cols-2 gap-6 sm:max-w-md">
            <div>
              <dt className="text-sm text-[var(--fg-quiet)]">Comprensione</dt>
              <dd className="text-2xl">{percent(s.comprehension)}</dd>
              <dd className="text-xs text-[var(--fg-quiet)]">domande mai viste prima</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--fg-quiet)]">Riconoscimento</dt>
              <dd className="text-2xl">{percent(s.recognition)}</dd>
              <dd className="text-xs text-[var(--fg-quiet)]">domande già viste</dd>
            </div>
          </dl>
          {s.comprehension !== null &&
            s.recognition !== null &&
            s.recognition - s.comprehension > 0.2 && (
              <p className="text-sm">
                Rispondi meglio alle domande che hai già visto: forse le stai ricordando, non
                ragionando. Rileggi i paragrafi segnati nelle materie.
              </p>
            )}
        </section>
      )}

      <p className="text-xs text-[var(--fg-quiet)]">{course.sourceNote}</p>
    </div>
  )
}

/** "Ho X minuti": a session sized to the time available, from the learner's own pace. */
function FewMinutes() {
  const [median, setMedian] = useState<number | null>(null)
  useEffect(() => {
    void loadAttempts().then((a) => {
      if (a.length < 10) return
      const xs = a.map((x) => x.elapsedSeconds).sort((x, y) => x - y)
      setMedian(xs[Math.floor(xs.length / 2)] ?? null)
    })
  }, [])
  return (
    <nav aria-label="Ho pochi minuti" className="flex flex-wrap items-center gap-1 text-sm">
      <span className="pr-2 text-[var(--fg-quiet)]">Ho</span>
      {[5, 10, 20, 30].map((m) => (
        <a
          key={m}
          href={hrefFor({
            name: 'study',
            subjectId: null,
            early: true,
            length: questionsForMinutes(m, median),
          })}
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--rule)] px-3"
        >
          {m} min
        </a>
      ))}
    </nav>
  )
}
