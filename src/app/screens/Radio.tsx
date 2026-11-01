import { useEffect, useId, useState } from 'react'
import { msg } from '../../core/i18n'
import {
  checkReadback,
  generateScenario,
  type ReadbackResult,
  type Scenario,
  scenarioKinds,
} from '../../core/radio/phraseology'
import { createRng, randomSeed } from '../../core/random'
import { Dictate } from '../Dictate'
import { t } from '../i18n'
import { Page, PrimaryButton, QuietButton } from '../ui'
import { speak, stopSpeaking, ttsSupported } from '../voice'

const rng = createRng(randomSeed())

const kindLabel: Record<(typeof scenarioKinds)[number], string> = {
  firstCall: msg('Prima chiamata'),
  taxi: msg('Rullaggio'),
  holdShort: msg('Attesa'),
  takeoff: msg('Decollo'),
  frequency: msg('Cambio frequenza'),
  squawk: msg('Transponder'),
  circuit: msg('Circuito'),
  opposite: msg('Cambio pista'),
  landing: msg('Atterraggio'),
}

/** Radio in English: listen to ATC, answer aloud or in writing, check the readback. */
export function Radio() {
  const [kind, setKind] = useState<string | null>(null)
  const [scenario, setScenario] = useState<Scenario>(() => generateScenario(rng, undefined, t))
  const [score, setScore] = useState({ done: 0, ok: 0 })
  const next = (k: string | null = kind) => setScenario(generateScenario(rng, k ?? undefined, t))

  useEffect(() => stopSpeaking, [])

  return (
    <Page title={t('Radio')}>
      <p className="text-sm text-[var(--fg-quiet)]">
        {t(
          'Fraseologia VFR in inglese (ICAO). Ogni esercizio ha nominativo, pista, QNH e codici nuovi: si allena l’ascolto e la collazione, non la memoria. La voce ATC è sintetizzata dal tuo sistema; la risposta a voce usa il riconoscimento del browser.',
        )}
      </p>
      <nav aria-label={t('Tipo di esercizio')}>
        <ul className="flex flex-wrap gap-1">
          {[null, ...scenarioKinds].map((k) => (
            <li key={k ?? 'all'}>
              <button
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k)
                  next(k)
                }}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${
                  kind === k ? 'border border-[var(--fg)]' : 'text-[var(--fg-quiet)]'
                }`}
              >
                {k ? t(kindLabel[k]) : t('Tutti')}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <Exercise
        key={scenario.exchanges[0]?.atc + scenario.situation}
        scenario={scenario}
        onDone={(ok) => setScore((s) => ({ done: s.done + 1, ok: s.ok + (ok ? 1 : 0) }))}
        next={() => next()}
      />
      {score.done > 0 && (
        <p className="text-sm text-[var(--fg-quiet)]">
          {t('Collazioni complete in questa sessione:')} {score.ok} {t('su')} {score.done}
        </p>
      )}
    </Page>
  )
}

function Exercise({
  scenario,
  onDone,
  next,
}: {
  scenario: Scenario
  onDone: (ok: boolean) => void
  next: () => void
}) {
  const ex = scenario.exchanges[0]
  const [answer, setAnswer] = useState('')
  const [showText, setShowText] = useState(!ex?.atcSpeech)
  const [result, setResult] = useState<ReadbackResult | null>(null)
  const [playing, setPlaying] = useState(false)
  const id = useId()
  const tts = ttsSupported()

  const play = async () => {
    if (!ex?.atcSpeech) return
    setPlaying(true)
    await speak(ex.atcSpeech, 'en-GB', 0.95)
    setPlaying(false)
  }

  if (!ex) return null
  return (
    <section className="flex flex-col gap-5 border-t border-[var(--rule)] pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{scenario.title}</h2>
        <p>{scenario.situation}</p>
      </div>

      {ex.atcSpeech && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {tts && (
              <PrimaryButton onClick={play} disabled={playing}>
                {playing ? t('ATC parla…') : t('Ascolta ATC')}
              </PrimaryButton>
            )}
            <QuietButton onClick={() => setShowText((s) => !s)} aria-expanded={showText}>
              {showText ? t('Nascondi il testo') : t('Mostra il testo')}
            </QuietButton>
          </div>
          {(showText || !tts) && (
            <p lang="en" className="border-l border-[var(--rule)] pl-4 font-mono text-sm">
              {ex.atc}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={id}>{ex.task}</label>
        <textarea
          id={id}
          lang="en"
          rows={3}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={result !== null}
          className="w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] p-3 font-mono text-[var(--fg)]"
        />
        {result === null && (
          <Dictate lang="en-GB" onText={(t) => setAnswer((a) => (a ? `${a} ${t}` : t))} />
        )}
      </div>

      {result === null ? (
        <PrimaryButton
          className="self-start"
          disabled={answer.trim().length < 3}
          onClick={() => {
            const r = checkReadback(answer, ex.required)
            setResult(r)
            onDone(r.ok)
          }}
        >
          {t('Controlla')}
        </PrimaryButton>
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-lg">{result.ok ? t('Collazione completa.') : t('Manca qualcosa.')}</p>
          <ul className="flex flex-col gap-1">
            {result.items.map((i) => (
              <li key={i.label} className="flex gap-3">
                <span aria-hidden="true" className="w-4">
                  {i.ok ? '✓' : '✗'}
                </span>
                <span>
                  {t(i.label)}
                  <span className="sr-only">{i.ok ? t(': presente') : t(': mancante')}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 text-sm">
            {ex.atcSpeech && (
              <p>
                <span className="text-[var(--fg-quiet)]">{t('ATC:')} </span>
                <span lang="en" className="font-mono">
                  {ex.atc}
                </span>
              </p>
            )}
            <p>
              <span className="text-[var(--fg-quiet)]">{t('Esempio di risposta:')} </span>
              <span lang="en" className="font-mono">
                {ex.model}
              </span>
            </p>
          </div>
          <PrimaryButton className="self-start" onClick={next} autoFocus>
            {t('Prossimo')}
          </PrimaryButton>
        </div>
      )}
    </section>
  )
}
