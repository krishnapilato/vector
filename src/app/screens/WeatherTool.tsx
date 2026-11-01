import { useId, useState } from 'react'
import { createRng, randomSeed } from '../../core/random'
import {
  describeMetar,
  type MetarQuestion,
  metarQuestions,
  parseMetar,
  parseTaf,
  randomMetar,
  vfrHint,
} from '../../core/weather/metar'
import { t } from '../i18n'
import { PrimaryButton, QuietButton } from '../ui'

const rng = createRng(randomSeed())
const API = 'https://aviationweather.gov/api/data'

const inputClass =
  'min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3 font-mono text-[var(--fg)]'

/** METAR and TAF: real ones from aviationweather.gov, or pasted, decoded in Italian; plus practice. */
export function WeatherTool() {
  const [mode, setMode] = useState<'decode' | 'practice'>('decode')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1" role="tablist" aria-label={t('Meteo')}>
        {(['decode', 'practice'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-lg px-3 text-sm ${mode === m ? 'border border-[var(--fg)]' : 'text-[var(--fg-quiet)]'}`}
          >
            {m === 'decode' ? t('Decodifica') : t('Esercizio')}
          </button>
        ))}
      </div>
      {mode === 'decode' ? <Decode /> : <Practice />}
    </div>
  )
}

function Decode() {
  const [icao, setIcao] = useState('LIMC')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const ids = { icao: useId(), text: useId() }

  const fetchReal = async () => {
    const code = icao.trim().toUpperCase()
    if (!/^[A-Z]{4}$/.test(code)) {
      setStatus(t('Inserisci un codice ICAO di 4 lettere.'))
      return
    }
    setStatus('Scarico…')
    try {
      const [metar, taf] = await Promise.all(
        ['metar', 'taf'].map((kind) =>
          fetch(`${API}/${kind}?ids=${code}&format=raw`, { cache: 'no-store' }).then((r) =>
            r.ok ? r.text() : '',
          ),
        ),
      )
      const all = [metar, taf]
        .map((x) => x?.trim())
        .filter(Boolean)
        .join('\n\n')
      if (!all) {
        setStatus(t('Nessun bollettino per questo aeroporto in questo momento.'))
        return
      }
      setText(all)
      setStatus(null)
    } catch {
      setStatus(t('Non riesco a scaricare i dati: incolla tu il METAR o il TAF qui sotto.'))
    }
  }

  const blocks = text
    .split(/\n\s*\n|(?=\bTAF\b)/)
    .map((b) => b.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.icao} className="text-sm">
            {t('Aeroporto (ICAO)')}
          </label>
          <input
            id={ids.icao}
            value={icao}
            maxLength={4}
            onChange={(e) => setIcao(e.target.value.toUpperCase())}
            className={`${inputClass} w-28 uppercase`}
          />
        </div>
        <PrimaryButton onClick={fetchReal}>{t('Scarica METAR e TAF')}</PrimaryButton>
      </div>
      <p className="text-xs text-[var(--fg-quiet)]">
        {t(
          'Dati da aviationweather.gov (NOAA): viene inviato solo il codice dell’aeroporto. Solo per studio, non per pianificare un volo.',
        )}
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.text} className="text-sm">
          {t('Oppure incolla un METAR o un TAF')}
        </label>
        <textarea
          id={ids.text}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} py-2 text-sm`}
        />
      </div>
      {status && (
        <p className="text-sm" aria-live="polite">
          {status}
        </p>
      )}
      {blocks.map((b) => (
        <Decoded key={b} raw={b} />
      ))}
    </div>
  )
}

function Decoded({ raw }: { raw: string }) {
  if (/^TAF\b/.test(raw)) {
    const taf = parseTaf(raw, t)
    return (
      <section className="flex flex-col gap-3 border-t border-[var(--rule)] pt-4">
        <h2 className="font-medium">{t('TAF')}</h2>
        {taf.groups.map((g) => (
          <div key={g.label + g.body.raw} className="flex flex-col gap-1">
            <p className="text-sm">{t(g.label)}</p>
            <Rows rows={describeMetar(g.body, t)} />
          </div>
        ))}
      </section>
    )
  }
  const m = parseMetar(raw)
  const hint = vfrHint(m)
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--rule)] pt-4">
      <h2 className="font-medium">
        {m.kind} {m.station}
        {hint && (
          <span className="text-sm font-normal text-[var(--fg-quiet)]">
            {' '}
            {t('· indicativamente')} {hint}
          </span>
        )}
      </h2>
      <Rows rows={describeMetar(m, t)} />
    </section>
  )
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map((r) => (
        <div key={`${r.label}-${r.value}`} className="contents">
          <dt className="text-[var(--fg-quiet)]">{t(r.label)}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Practice() {
  const [raw, setRaw] = useState(() => randomMetar(rng))
  const [questions, setQuestions] = useState<MetarQuestion[]>(() =>
    metarQuestions(parseMetar(raw), rng, t),
  )
  const [picked, setPicked] = useState<Record<number, string>>({})
  const done = Object.keys(picked).length === questions.length
  const right = questions.filter((q, i) => picked[i] === q.answer).length

  const fresh = () => {
    const r = randomMetar(rng)
    setRaw(r)
    setQuestions(metarQuestions(parseMetar(r), rng, t))
    setPicked({})
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-sm leading-relaxed">{raw}</p>
      {questions.map((q, i) => (
        <fieldset key={q.prompt} className="flex flex-col gap-2">
          <legend className="pb-2">{q.prompt}</legend>
          {q.options.map((o) => {
            const chosen = picked[i]
            const state =
              chosen === undefined ? '' : o === q.answer ? ' ✓' : chosen === o ? ' ✗' : ''
            return (
              <button
                key={o}
                type="button"
                disabled={chosen !== undefined}
                onClick={() => setPicked((p) => ({ ...p, [i]: o }))}
                className={`min-h-11 rounded-lg border px-3 text-left text-sm ${
                  chosen !== undefined && o === q.answer
                    ? 'border-[var(--fg)]'
                    : 'border-[var(--rule)]'
                }`}
              >
                {o}
                {state}
              </button>
            )
          })}
        </fieldset>
      ))}
      {done && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p>
            {right} {t('su')} {questions.length}.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--fg-quiet)]">
              {t('Decodifica completa')}
            </summary>
            <div className="mt-2">
              <Rows rows={describeMetar(parseMetar(raw), t)} />
            </div>
          </details>
        </div>
      )}
      <QuietButton className="self-start" onClick={fresh}>
        {t('Nuovo METAR')}
      </QuietButton>
    </div>
  )
}
