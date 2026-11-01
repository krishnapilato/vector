import { useEffect, useState } from 'react'
import {
  formatClock,
  nextPhase,
  pause,
  phaseLabel,
  phaseMs,
  remaining,
  resume,
  startPomodoro,
} from '../../core/pomodoro'
import { askNotificationPermission } from '../alerts'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { LinkButton, PrimaryButton, QuietButton, QuietLink } from '../ui'

/**
 * Study state, like a session: no menu. The time is hidden by default and shown
 * for two seconds on request, so the clock never becomes the thing you watch.
 */
export function PomodoroScreen() {
  const { pomodoro, setPomodoro, prefs } = useStore()
  const cfg = prefs.config.pomodoro
  const [now, setNow] = useState(Date.now())
  const [showTime, setShowTime] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!showTime) return
    const id = setTimeout(() => setShowTime(false), 2000)
    return () => clearTimeout(id)
  }, [showTime])

  const start = async () => {
    await askNotificationPermission()
    setPomodoro(startPomodoro(Date.now(), cfg))
  }

  const left = pomodoro ? remaining(pomodoro, now) : phaseMs('focus', cfg)
  const total = pomodoro ? phaseMs(pomodoro.phase, cfg) : phaseMs('focus', cfg)
  const running = pomodoro?.endsAt !== null && pomodoro !== null

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-px bg-[var(--rule)]" aria-hidden="true">
        <div className="h-px bg-[var(--fg)]" style={{ width: `${(1 - left / total) * 100}%` }} />
      </div>
      <header className="mx-auto flex w-full max-w-2xl justify-end px-6 pt-3">
        <QuietLink href="#/piano">Esci</QuietLink>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 pb-16">
        <p className="text-sm text-[var(--fg-quiet)]">
          {pomodoro
            ? `Pomodoro ${pomodoro.completed + (pomodoro.phase === 'focus' ? 1 : 0)}`
            : 'Pomodoro'}
          {pomodoro && !running && ' · in pausa'}
        </p>
        <h1 className="text-4xl font-medium tracking-tight">
          {pomodoro ? phaseLabel[pomodoro.phase] : `${cfg.focusMinutes} minuti di concentrazione`}
        </h1>
        <p className="min-h-10 text-3xl tabular-nums" aria-live="polite">
          {showTime || !pomodoro ? formatClock(left) : ''}
        </p>

        {!pomodoro ? (
          <div>
            <PrimaryButton onClick={start}>Inizia</PrimaryButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {pomodoro.phase === 'focus' && (
              <LinkButton href={hrefFor({ name: 'study', subjectId: null, early: false })}>
                Studia adesso
              </LinkButton>
            )}
            <QuietButton onClick={() => setShowTime(true)}>Mostra il tempo</QuietButton>
            <QuietButton
              onClick={() =>
                setPomodoro(running ? pause(pomodoro, Date.now()) : resume(pomodoro, Date.now()))
              }
            >
              {running ? 'Pausa' : 'Riprendi'}
            </QuietButton>
            <QuietButton onClick={() => setPomodoro(nextPhase(pomodoro, Date.now(), cfg, false))}>
              Salta
            </QuietButton>
            <QuietButton onClick={() => setPomodoro(null)}>Ferma</QuietButton>
          </div>
        )}
        <p className="max-w-prose text-sm text-[var(--fg-quiet)]">
          Il pomodoro continua anche mentre studi: alla fine di ogni fase senti un breve suono
          {typeof Notification !== 'undefined' && Notification.permission === 'granted'
            ? ' e ricevi una notifica'
            : ''}
          . Saltare una fase non la conta come completata.
        </p>
      </main>
    </div>
  )
}
