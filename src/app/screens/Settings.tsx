import { type ReactNode, useId, useState } from 'react'
import { type Config, configSchema } from '../../config/config'
import { msg } from '../../core/i18n'
import type { QuestionKind } from '../../core/question-timer'
import { generatePassphrase, passphraseProblem, WrongPassphrase } from '../../core/sync/crypto'
import { AiError, DEFAULT_MODEL, listModels } from '../ai/gemini'
import { exportAll, loadPreferences, type Preferences, savePreferences } from '../data/db'
import { type Language, languageLabel, locale, t } from '../i18n'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { download, encryptedBackup, pull, push, restoreBackup, SyncConflict } from '../sync/sync'
import { Page, PrimaryButton, QuietButton } from '../ui'

const timerLabels: Record<QuestionKind, string> = {
  recall: msg('Richiamo veloce'),
  reasoning: msg('Ragionamento'),
  calculation: msg('Calcolo'),
  open: msg('Domanda aperta'),
}

export function Settings() {
  const { prefs, updatePrefs } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async (next: Preferences) => {
    const parsed = configSchema.safeParse(next.config)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('Valore non valido.'))
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
    <Page title={t('Impostazioni')}>
      <p className="text-sm text-[var(--fg-quiet)]" aria-live="polite">
        {error ? (
          <span role="alert">{error}</span>
        ) : saved ? (
          t('Salvato su questo dispositivo.')
        ) : (
          t('Le modifiche si salvano da sole.')
        )}
      </p>

      <Section title={t('Studio')}>
        <Field label={t('Modalità')}>
          <div className="flex flex-col gap-2">
            <Radio
              name="mode"
              checked={prefs.study.mode === 'practice'}
              onChange={() => setStudy({ mode: 'practice' })}
              label={t('Allenamento')}
              hint={t('con un timer per ogni domanda')}
            />
            <Radio
              name="mode"
              checked={prefs.study.mode === 'understand'}
              onChange={() => setStudy({ mode: 'understand' })}
              label={t('Capire')}
              hint={t('senza timer, per i capitoli nuovi')}
            />
          </div>
        </Field>
        <NumberField
          label={t('Domande per sessione')}
          value={prefs.study.sessionLength}
          min={1}
          max={50}
          onChange={(v) => {
            setStudy({ sessionLength: v })
          }}
        />
        <NumberField
          label={t('Concetti nuovi per sessione')}
          value={prefs.study.newConcepts}
          min={0}
          max={20}
          onChange={(v) => setStudy({ newConcepts: v })}
        />
        <Checkbox
          label={t('Schermo intero durante lo studio')}
          checked={prefs.study.fullscreen}
          onChange={(v) => setStudy({ fullscreen: v })}
        />
        <Checkbox
          label={t('Adatta le spiegazioni dell’IA a come studio')}
          checked={prefs.study.personalize}
          onChange={(v) => setStudy({ personalize: v })}
        />
        {prefs.course.template === 'ppl-easa' && (
          <Checkbox
            label={t('Includi i concetti di esempio scritti a mano')}
            checked={prefs.study.includeSample}
            onChange={(v) => setStudy({ includeSample: v })}
          />
        )}
      </Section>

      <Section title={t('Timer (secondi, modalità Allenamento)')}>
        {(Object.keys(timerLabels) as QuestionKind[]).map((kind) => (
          <NumberField
            key={kind}
            label={t(timerLabels[kind])}
            value={prefs.config.timers[kind]}
            min={5}
            max={3600}
            onChange={(v) => setConfig((c) => ({ ...c, timers: { ...c.timers, [kind]: v } }))}
          />
        ))}
        <NumberField
          label={t('Pausa per pensare prima delle opzioni')}
          value={prefs.config.quiz.thinkFirstSeconds}
          min={0}
          max={30}
          onChange={(v) => setConfig((c) => ({ ...c, quiz: { ...c.quiz, thinkFirstSeconds: v } }))}
        />
        <NumberField
          label={t('Domande «Perché?» (% delle risposte giuste)')}
          value={Math.round(prefs.config.quiz.whyProbability * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            setConfig((c) => ({ ...c, quiz: { ...c.quiz, whyProbability: v / 100 } }))
          }
        />
      </Section>

      <ExamSection />

      <FocusSection prefs={prefs} save={save} setConfig={setConfig} />

      <AiSection />

      <SyncSection />

      <DataSection />
    </Page>
  )
}

function ExamSection() {
  const { prefs, updatePrefs } = useStore()
  const [examName, setExamName] = useState(prefs.course.examName)
  const ids = { lang: useId(), exam: useId() }
  const setCourse = (patch: Partial<Preferences['course']>) =>
    updatePrefs({ ...prefs, course: { ...prefs.course, ...patch } })

  return (
    <Section title={t('Esame e lingua')}>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.lang} className="text-sm">
          {t('Lingua dell’interfaccia')}
        </label>
        <select
          id={ids.lang}
          value={prefs.ui.language}
          onChange={async (e) => {
            await updatePrefs({ ...prefs, ui: { language: e.target.value as Language } })
            location.reload()
          }}
          className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
        >
          {(Object.keys(languageLabel) as Language[]).map((l) => (
            <option key={l} value={l}>
              {languageLabel[l]}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--fg-quiet)]">
          {t('Il corso PPL di esempio, il glossario e la fraseologia restano nella loro lingua.')}
        </p>
      </div>
      <Field label={t('Esame')}>
        <Radio
          name="template"
          checked={prefs.course.template === 'ppl-easa'}
          onChange={() => {
            setExamName('PPL(A) EASA')
            void setCourse({ template: 'ppl-easa', examName: 'PPL(A) EASA' })
          }}
          label={t('PPL(A) EASA')}
          hint={t('materie, radio, meteo e strumenti di volo')}
        />
        <Radio
          name="template"
          checked={prefs.course.template === 'custom'}
          onChange={() => {
            const name =
              examName === 'PPL(A) EASA' || !examName.trim() ? t('Il mio esame') : examName
            setExamName(name)
            void setCourse({ template: 'custom', examName: name })
          }}
          label={t('Un altro esame')}
          hint={t('materie tue, domande dai tuoi libri')}
        />
      </Field>
      {prefs.course.template === 'custom' && (
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.exam} className="text-sm">
            {t('Nome dell’esame')}
          </label>
          <input
            id={ids.exam}
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            onBlur={() => examName.trim() && setCourse({ examName: examName.trim() })}
            className={inputClass}
          />
          <p className="text-xs text-[var(--fg-quiet)]">
            {t('Le materie si aggiungono dalla pagina Materie.')}
          </p>
        </div>
      )}
      <a
        href={hrefFor({ name: 'profiles' })}
        className="self-start text-sm underline underline-offset-4"
      >
        {t('Profili: più persone su questo dispositivo')}
      </a>
    </Section>
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
          ? t('Il browser non ha concesso la fotocamera.')
          : t('Il browser non ha concesso il microfono.'),
      )
    }
  }

  return (
    <Section title={t('Concentrazione')}>
      <p className="text-sm text-[var(--fg-quiet)]">
        {t(
          'L’uscita dall’app viene sempre contata. Fotocamera e microfono sono facoltativi: le immagini e l’audio vengono analizzati in memoria su questo dispositivo e scartati subito, mai salvati né inviati. Vector non ascolta cosa si dice: capisce solo se c’è una voce e se è la tua. I modelli di analisi si scaricano una volta da Google e poi restano in cache.',
        )}
      </p>
      <Checkbox
        label={t('Usa la fotocamera')}
        checked={prefs.focus.camera}
        onChange={(v) => void enable('camera', v)}
      />
      {prefs.focus.camera && (
        <Checkbox
          label={t('Accorgiti del telefono in mano')}
          checked={prefs.focus.phone}
          onChange={(v) => set({ phone: v })}
        />
      )}
      <Checkbox
        label={t('Usa il microfono')}
        checked={prefs.focus.mic}
        onChange={(v) => void enable('mic', v)}
      />
      {prefs.focus.mic && (
        <Checkbox
          label={t('Studio ad alta voce: la mia voce non è una distrazione')}
          checked={prefs.focus.aloud}
          onChange={(v) => set({ aloud: v })}
        />
      )}
      <Checkbox
        label={t('Suono quando mi distraggo')}
        checked={prefs.focus.sound}
        onChange={(v) => set({ sound: v })}
      />
      <NumberField
        label={t('Ignora distrazioni più brevi di (secondi)')}
        value={prefs.config.focus.ignoreDistractionSeconds}
        min={0}
        max={60}
        onChange={(v) =>
          setConfig((c) => ({ ...c, focus: { ...c.focus, ignoreDistractionSeconds: v } }))
        }
      />
      <NumberField
        label={t('Metti in pausa dopo (secondi lontano)')}
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

const inputClass =
  'min-h-11 w-full rounded-lg border border-[var(--rule)] bg-transparent px-3 text-[var(--fg)]'

const errorText = (e: unknown) =>
  e instanceof WrongPassphrase || e instanceof Error
    ? t(e.message)
    : t('Qualcosa non ha funzionato.')

function SyncSection() {
  const { prefs, updatePrefs, reload } = useStore()
  const [url, setUrl] = useState(prefs.sync.url ?? '')
  const [phrase, setPhrase] = useState(prefs.sync.passphrase ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = { url: useId(), phrase: useId() }
  const problem = phrase ? passphraseProblem(phrase) : null
  const changed =
    url.trim() !== (prefs.sync.url ?? '') || phrase.trim() !== (prefs.sync.passphrase ?? '')

  const saveSync = (patch: Partial<Preferences['sync']>) =>
    updatePrefs({ ...prefs, sync: { ...prefs.sync, ...patch } })

  const run = async (what: 'push' | 'pull') => {
    setBusy(true)
    setStatus(what === 'push' ? t('Cifro e invio…') : t('Ricevo e decifro…'))
    try {
      const s = { ...prefs.sync, url: url.trim(), passphrase: phrase.trim() }
      if (what === 'push') {
        const { version } = await push(s)
        await saveSync({ ...s, version, lastSyncedAt: new Date().toISOString() })
        setStatus('Inviato.')
      } else {
        await saveSync(s)
        const r = await pull(s)
        if (!r) {
          setStatus(t('Sul server non c’è ancora niente: invia da questo dispositivo.'))
        } else {
          const fresh = await loadPreferences()
          await savePreferences({
            ...fresh,
            sync: { ...s, version: r.version, lastSyncedAt: new Date().toISOString() },
          })
          await reload()
          setStatus(t('Ricevuto: i dati di questo dispositivo sono stati sostituiti.'))
        }
      }
    } catch (e) {
      setStatus(e instanceof SyncConflict ? e.message : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('Sincronizzazione tra dispositivi')}>
      <p className="text-sm text-[var(--fg-quiet)]">
        {t('Facoltativa, con un server tuo (istruzioni in')} <code>{t('worker/README.md')}</code>{' '}
        {t(
          'nel repository). Tutto viene cifrato qui con la frase segreta prima di partire: il server non può leggere niente. Usa la stessa frase su ogni dispositivo. Se la perdi, i dati sul server sono irrecuperabili. Il testo dei libri non viene sincronizzato.',
        )}
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.url} className="text-sm">
          {t('Indirizzo del server')}
        </label>
        <input
          id={ids.url}
          type="url"
          inputMode="url"
          placeholder={t('https://vector-sync.tuonome.workers.dev')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.phrase} className="text-sm">
          {t('Frase segreta')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={ids.phrase}
            autoComplete="off"
            spellCheck={false}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className={`${inputClass} flex-1 font-mono text-sm`}
          />
          <QuietButton onClick={() => setPhrase(generatePassphrase())}>{t('Genera')}</QuietButton>
        </div>
        {problem && <p className="text-sm">{t(problem)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton
          disabled={busy || !url.trim() || !phrase.trim() || problem !== null}
          onClick={() => run('push')}
        >
          {t('Invia da qui')}
        </PrimaryButton>
        <QuietButton
          disabled={busy || !url.trim() || !phrase.trim() || problem !== null}
          onClick={() => run('pull')}
        >
          {t('Ricevi (sostituisce i dati qui)')}
        </QuietButton>
        {changed && !busy && (
          <span className="text-xs text-[var(--fg-quiet)]">
            {t('Si salvano al primo invio o ricezione.')}
          </span>
        )}
      </div>
      {prefs.sync.lastSyncedAt && (
        <p className="text-xs text-[var(--fg-quiet)]">
          {t('Ultima sincronizzazione:')}{' '}
          {new Date(prefs.sync.lastSyncedAt).toLocaleString(locale())} {t('· versione')}{' '}
          {prefs.sync.version}
        </p>
      )}
      {status && (
        <p className="text-sm" aria-live="polite">
          {status}
        </p>
      )}
    </Section>
  )
}

function DataSection() {
  const { reset, reload } = useStore()
  const [phrase, setPhrase] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const ids = { phrase: useId(), file: useId() }
  const date = () => new Date().toISOString().slice(0, 10)

  return (
    <Section title={t('I tuoi dati')}>
      <p className="text-sm text-[var(--fg-quiet)]">
        {t(
          'Progressi e impostazioni sono salvati solo in questo browser. I backup non contengono la chiave API né il testo dei libri.',
        )}
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.phrase} className="text-sm">
          {t('Frase segreta per il backup cifrato')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={ids.phrase}
            autoComplete="off"
            spellCheck={false}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className={`${inputClass} flex-1 font-mono text-sm`}
          />
          <QuietButton onClick={() => setPhrase(generatePassphrase())}>{t('Genera')}</QuietButton>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <QuietButton
          disabled={!phrase.trim() || passphraseProblem(phrase) !== null}
          onClick={async () => {
            setStatus('Cifro…')
            download(await encryptedBackup(phrase.trim()), `vector-backup-cifrato-${date()}.json`)
            setStatus(t('Backup cifrato scaricato. Conserva la frase: senza non si apre.'))
          }}
        >
          {t('Scarica un backup cifrato')}
        </QuietButton>
        <QuietButton
          onClick={async () =>
            download(
              new Blob([await exportAll()], { type: 'application/json' }),
              `vector-backup-${date()}.json`,
            )
          }
        >
          {t('Scarica un backup leggibile')}
        </QuietButton>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.file} className="text-sm">
          {t('Ripristina da un backup (sostituisce i dati qui)')}
        </label>
        <input
          id={ids.file}
          type="file"
          accept="application/json,.json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-4 file:min-h-11 file:rounded-lg file:border file:border-[var(--rule)] file:bg-transparent file:px-4 file:text-[var(--fg)]"
        />
        <QuietButton
          className="self-start"
          disabled={!file}
          onClick={async () => {
            if (!file) return
            try {
              setStatus('Ripristino…')
              await restoreBackup(await file.text(), phrase.trim() || null)
              await reload()
              setStatus(
                t('Backup ripristinato. Ricollega i PDF dalla Libreria per leggere i libri.'),
              )
            } catch (e) {
              setStatus(errorText(e))
            }
          }}
        >
          {t('Ripristina')}
        </QuietButton>
      </div>
      {status && (
        <p className="text-sm" aria-live="polite">
          {status}
        </p>
      )}
      <div>
        <ResetButton onReset={reset} />
      </div>
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
    setStatus(t('Verifico la chiave…'))
    try {
      const found = await listModels(key.trim())
      await saveAi({ apiKey: key.trim() })
      setModels(found)
      setStatus(t('Chiave valida. {length} modelli disponibili.', { length: found.length }))
    } catch (e) {
      setStatus(e instanceof AiError ? e.message : t('Verifica non riuscita.'))
    }
  }

  return (
    <Section title={t('Intelligenza artificiale (Gemini)')}>
      <p className="text-sm text-[var(--fg-quiet)]">
        {t(
          'Facoltativa. Serve per rispiegare un concetto dopo un errore, creare domande dai tuoi libri, correggere le risposte a parole e spiegare un termine nella frase. Riceve solo il testo necessario, mai dati personali. La chiave resta su questo dispositivo.',
        )}
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={keyId} className="text-sm">
          {t('Chiave API di Google AI Studio')}
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
            {t('Verifica e salva')}
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
          {t('Modello')}
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
            setStatus(t('Chiave rimossa da questo dispositivo.'))
          }}
        >
          {t('Rimuovi la chiave')}
        </QuietButton>
      )}
    </Section>
  )
}

function ResetButton({ onReset }: { onReset: () => Promise<void> }) {
  const [armed, setArmed] = useState(false)
  if (!armed)
    return <QuietButton onClick={() => setArmed(true)}>{t('Cancella tutti i dati')}</QuietButton>
  return (
    <span className="flex flex-wrap items-center gap-2">
      <QuietButton
        className="text-[var(--fg)] underline"
        onClick={async () => {
          await onReset()
          setArmed(false)
        }}
      >
        {t('Conferma: cancella tutto')}
      </QuietButton>
      <QuietButton onClick={() => setArmed(false)}>{t('Annulla')}</QuietButton>
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
