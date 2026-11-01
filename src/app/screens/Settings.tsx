import { type ReactNode, useId, useState } from 'react'
import { type Config, configSchema } from '../../config/config'
import type { QuestionKind } from '../../core/question-timer'
import { AiError, DEFAULT_MODEL, listModels } from '../ai/gemini'
import { exportAll, type Preferences } from '../data/db'
import { useStore } from '../state'
import { Page, PrimaryButton, QuietButton } from '../ui'

const timerLabels: Record<QuestionKind, string> = {
  recall: 'Richiamo veloce',
  reasoning: 'Ragionamento',
  calculation: 'Calcolo',
  open: 'Domanda aperta',
}

export function Settings() {
  const { prefs, updatePrefs, reset } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async (next: Preferences) => {
    const parsed = configSchema.safeParse(next.config)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Valore non valido.')
      return
    }
    setError(null)
    await updatePrefs({ ...next, config: parsed.data })
    setSaved(true)
  }
  const setStudy = (patch: Partial<Preferences['study']>) =>
    save({ ...prefs, study: { ...prefs.study, ...patch } })
  const setConfig = (fn: (c: Config) => Config) => save({ ...prefs, config: fn(prefs.config) })

  return (
    <Page title="Impostazioni">
      <p className="text-sm text-[var(--fg-quiet)]" aria-live="polite">
        {error ? (
          <span role="alert">{error}</span>
        ) : saved ? (
          'Salvato su questo dispositivo.'
        ) : (
          'Le modifiche si salvano da sole.'
        )}
      </p>

      <Section title="Studio">
        <Field label="Modalità">
          <div className="flex flex-col gap-2">
            <Radio
              name="mode"
              checked={prefs.study.mode === 'practice'}
              onChange={() => setStudy({ mode: 'practice' })}
              label="Allenamento"
              hint="con un timer per ogni domanda"
            />
            <Radio
              name="mode"
              checked={prefs.study.mode === 'understand'}
              onChange={() => setStudy({ mode: 'understand' })}
              label="Capire"
              hint="senza timer, per i capitoli nuovi"
            />
          </div>
        </Field>
        <NumberField
          label="Domande per sessione"
          value={prefs.study.sessionLength}
          min={1}
          max={50}
          onChange={(v) => {
            setStudy({ sessionLength: v })
          }}
        />
        <NumberField
          label="Concetti nuovi per sessione"
          value={prefs.study.newConcepts}
          min={0}
          max={20}
          onChange={(v) => setStudy({ newConcepts: v })}
        />
        <Checkbox
          label="Schermo intero durante lo studio"
          checked={prefs.study.fullscreen}
          onChange={(v) => setStudy({ fullscreen: v })}
        />
        <Checkbox
          label="Adatta le spiegazioni dell’IA a come studio"
          checked={prefs.study.personalize}
          onChange={(v) => setStudy({ personalize: v })}
        />
        <Checkbox
          label="Includi i concetti di esempio scritti a mano"
          checked={prefs.study.includeSample}
          onChange={(v) => setStudy({ includeSample: v })}
        />
      </Section>

      <Section title="Timer (secondi, modalità Allenamento)">
        {(Object.keys(timerLabels) as QuestionKind[]).map((kind) => (
          <NumberField
            key={kind}
            label={timerLabels[kind]}
            value={prefs.config.timers[kind]}
            min={5}
            max={3600}
            onChange={(v) => setConfig((c) => ({ ...c, timers: { ...c.timers, [kind]: v } }))}
          />
        ))}
        <NumberField
          label="Pausa per pensare prima delle opzioni"
          value={prefs.config.quiz.thinkFirstSeconds}
          min={0}
          max={30}
          onChange={(v) => setConfig((c) => ({ ...c, quiz: { ...c.quiz, thinkFirstSeconds: v } }))}
        />
        <NumberField
          label="Domande «Perché?» (% delle risposte giuste)"
          value={Math.round(prefs.config.quiz.whyProbability * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            setConfig((c) => ({ ...c, quiz: { ...c.quiz, whyProbability: v / 100 } }))
          }
        />
      </Section>

      <FocusSection prefs={prefs} save={save} setConfig={setConfig} />

      <AiSection />

      <Section title="I tuoi dati">
        <p className="text-sm text-[var(--fg-quiet)]">
          Progressi e impostazioni sono salvati solo in questo browser. Il backup non contiene la
          chiave API.
        </p>
        <div className="flex flex-wrap gap-4">
          <QuietButton
            onClick={async () => {
              const blob = new Blob([await exportAll()], { type: 'application/json' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `vector-backup-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
          >
            Scarica un backup
          </QuietButton>
          <ResetButton onReset={reset} />
        </div>
      </Section>
    </Page>
  )
}

function FocusSection({
  prefs,
  save,
  setConfig,
}: {
  prefs: Preferences
  save: (p: Preferences) => Promise<void>
  setConfig: (fn: (c: Config) => Config) => Promise<void>
}) {
  const [note, setNote] = useState<string | null>(null)
  const set = (patch: Partial<Preferences['focus']>) =>
    save({ ...prefs, focus: { ...prefs.focus, ...patch } })

  /** Asks the browser for permission right away, so the first session isn't interrupted. */
  const enable = async (kind: 'camera' | 'mic', on: boolean) => {
    if (!on) return set({ [kind]: false })
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'camera' ? { video: true } : { audio: true },
      )
      for (const t of stream.getTracks()) t.stop()
      setNote(null)
      await set({ [kind]: true })
    } catch {
      setNote(
        kind === 'camera'
          ? 'Il browser non ha concesso la fotocamera.'
          : 'Il browser non ha concesso il microfono.',
      )
    }
  }

  return (
    <Section title="Concentrazione">
      <p className="text-sm text-[var(--fg-quiet)]">
        L’uscita dall’app viene sempre contata. Fotocamera e microfono sono facoltativi: le immagini
        e l’audio vengono analizzati in memoria su questo dispositivo e scartati subito, mai salvati
        né inviati. Vector non ascolta cosa si dice: capisce solo se c’è una voce e se è la tua. I
        modelli di analisi si scaricano una volta da Google e poi restano in cache.
      </p>
      <Checkbox
        label="Usa la fotocamera"
        checked={prefs.focus.camera}
        onChange={(v) => void enable('camera', v)}
      />
      {prefs.focus.camera && (
        <Checkbox
          label="Accorgiti del telefono in mano"
          checked={prefs.focus.phone}
          onChange={(v) => set({ phone: v })}
        />
      )}
      <Checkbox
        label="Usa il microfono"
        checked={prefs.focus.mic}
        onChange={(v) => void enable('mic', v)}
      />
      {prefs.focus.mic && (
        <Checkbox
          label="Studio ad alta voce: la mia voce non è una distrazione"
          checked={prefs.focus.aloud}
          onChange={(v) => set({ aloud: v })}
        />
      )}
      <Checkbox
        label="Suono quando mi distraggo"
        checked={prefs.focus.sound}
        onChange={(v) => set({ sound: v })}
      />
      <NumberField
        label="Ignora distrazioni più brevi di (secondi)"
        value={prefs.config.focus.ignoreDistractionSeconds}
        min={0}
        max={60}
        onChange={(v) =>
          setConfig((c) => ({ ...c, focus: { ...c.focus, ignoreDistractionSeconds: v } }))
        }
      />
      <NumberField
        label="Metti in pausa dopo (secondi lontano)"
        value={prefs.config.focus.pauseAfterSeconds}
        min={1}
        max={600}
        onChange={(v) => setConfig((c) => ({ ...c, focus: { ...c.focus, pauseAfterSeconds: v } }))}
      />
      {note && (
        <p role="alert" className="text-sm">
          {note}
        </p>
      )}
    </Section>
  )
}

function AiSection() {
  const { prefs, updatePrefs } = useStore()
  const [key, setKey] = useState(prefs.ai.apiKey ?? '')
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const keyId = useId()
  const modelId = useId()

  const saveAi = (patch: Partial<Preferences['ai']>) =>
    updatePrefs({ ...prefs, ai: { ...prefs.ai, ...patch } })

  const test = async () => {
    setStatus('Verifico la chiave…')
    try {
      const found = await listModels(key.trim())
      await saveAi({ apiKey: key.trim() })
      setModels(found)
      setStatus(`Chiave valida. ${found.length} modelli disponibili.`)
    } catch (e) {
      setStatus(e instanceof AiError ? e.message : 'Verifica non riuscita.')
    }
  }

  return (
    <Section title="Intelligenza artificiale (Gemini)">
      <p className="text-sm text-[var(--fg-quiet)]">
        Facoltativa. Serve per rispiegare un concetto dopo un errore, creare domande dai tuoi libri,
        correggere le risposte a parole e spiegare un termine nella frase. Riceve solo il testo
        necessario, mai dati personali. La chiave resta su questo dispositivo.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={keyId} className="text-sm">
          Chiave API di Google AI Studio
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id={keyId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="min-h-11 flex-1 rounded-lg border border-[var(--rule)] bg-transparent px-3 font-mono text-sm"
          />
          <PrimaryButton onClick={test} disabled={key.trim().length < 10}>
            Verifica e salva
          </PrimaryButton>
        </div>
        {status && (
          <p className="text-sm" aria-live="polite">
            {status}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={modelId} className="text-sm">
          Modello
        </label>
        <select
          id={modelId}
          value={prefs.ai.model}
          onChange={(e) => saveAi({ model: e.target.value })}
          className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3 text-sm"
        >
          {[...new Set([prefs.ai.model, DEFAULT_MODEL, ...models])].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {prefs.ai.apiKey && (
        <QuietButton
          className="self-start"
          onClick={async () => {
            await saveAi({ apiKey: null })
            setKey('')
            setStatus('Chiave rimossa da questo dispositivo.')
          }}
        >
          Rimuovi la chiave
        </QuietButton>
      )}
    </Section>
  )
}

function ResetButton({ onReset }: { onReset: () => Promise<void> }) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <QuietButton onClick={() => setArmed(true)}>Cancella tutti i dati</QuietButton>
  return (
    <span className="flex flex-wrap items-center gap-2">
      <QuietButton
        className="text-[var(--fg)] underline"
        onClick={async () => {
          await onReset()
          setArmed(false)
        }}
      >
        Conferma: cancella tutto
      </QuietButton>
      <QuietButton onClick={() => setArmed(false)}>Annulla</QuietButton>
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-[var(--rule)] pt-6">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm">{label}</legend>
      {children}
    </fieldset>
  )
}

function Radio(p: {
  name: string
  checked: boolean
  onChange: () => void
  label: string
  hint: string
}) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="radio"
        name={p.name}
        checked={p.checked}
        onChange={p.onChange}
        className="size-4 accent-current"
      />
      <span>
        {p.label} <span className="text-sm text-[var(--fg-quiet)]">· {p.hint}</span>
      </span>
    </label>
  )
}

function Checkbox(p: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        checked={p.checked}
        onChange={(e) => p.onChange(e.target.checked)}
        className="size-4 accent-current"
      />
      {p.label}
    </label>
  )
}

function NumberField(p: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(String(p.value))
  const commit = () => {
    const v = Number(draft)
    if (Number.isInteger(v) && v >= p.min && v <= p.max) p.onChange(v)
    else setDraft(String(p.value))
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label htmlFor={id}>{p.label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={p.min}
        max={p.max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="min-h-11 w-24 rounded-lg border border-[var(--rule)] bg-transparent px-3 text-right"
      />
    </div>
  )
}
