import { useEffect, useId, useRef, useState } from 'react'
import { buildContextPrompt } from '../../core/ai/prompt'
import {
  buildQuestionsPrompt,
  extractJson,
  parseGenerated,
  type UserConcept,
} from '../../core/ai/questions'
import { type GlossaryEntry, lookup } from '../../core/content/glossary'
import type { Book, Highlight } from '../../core/reading/book'
import { type SearchHit, searchPages } from '../../core/reading/text'
import { AiError, generate } from '../ai/gemini'
import { countLookup, type Drawing, loadAllPages, loadDrawings, loadPages } from '../data/db'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { PrimaryButton, QuietButton, QuietLink } from '../ui'
import type { PanelKind } from './Reader'
import { tools } from './Tools'

const inputClass =
  'min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3 text-[var(--fg)]'

const titles: Record<PanelKind, string> = {
  toc: 'Indice',
  search: 'Cerca nel libro',
  glossary: 'Glossario',
  notes: 'Evidenziazioni e note',
  highlight: 'Evidenziazione',
  generate: 'Crea domande',
  tools: 'Strumenti',
}

export interface PanelProps {
  kind: PanelKind
  book: Book
  page: number
  go: (page: number) => void
  close: () => void
  highlights: Highlight[]
  activeHighlight: Highlight | null
  updateHighlight: (h: Highlight) => Promise<void>
  removeHighlight: (id: string) => Promise<void>
  glossaryTerm: string
  glossaryContext: string
}

/** One side panel at a time, closed with Esc. */
export function ReaderPanels(props: PanelProps) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])')
      ?.focus()
  }, [])
  return (
    <aside
      ref={ref}
      aria-label={titles[props.kind]}
      className="fixed inset-y-0 right-0 z-20 flex w-full max-w-md flex-col gap-6 overflow-y-auto border-l border-[var(--rule)] bg-[var(--bg)] p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">{titles[props.kind]}</h2>
        <QuietButton data-close onClick={props.close}>
          Chiudi (Esc)
        </QuietButton>
      </div>
      {props.kind === 'toc' && <Toc {...props} />}
      {props.kind === 'search' && <Search {...props} />}
      {props.kind === 'glossary' && <Glossary {...props} />}
      {props.kind === 'notes' && <Notes {...props} />}
      {props.kind === 'highlight' && <HighlightEditor {...props} />}
      {props.kind === 'generate' && <Generate {...props} />}
      {props.kind === 'tools' && <ToolPicker />}
    </aside>
  )
}

function Toc({ book, page, go }: PanelProps) {
  if (book.chapters.length === 0)
    return <p className="text-[var(--fg-quiet)]">Questo libro non ha un indice.</p>
  return (
    <ol className="flex flex-col">
      {book.chapters.map((c) => {
        const current = page >= c.startPage && page <= c.endPage
        return (
          <li key={`${c.startPage}-${c.title}`}>
            <button
              type="button"
              onClick={() => go(c.startPage)}
              aria-current={current ? 'true' : undefined}
              className={`flex min-h-11 w-full items-baseline justify-between gap-4 text-left ${
                current
                  ? 'text-[var(--fg)] underline underline-offset-4'
                  : 'text-[var(--fg-quiet)] hover:text-[var(--fg)]'
              }`}
            >
              <span>{c.title}</span>
              <span className="text-xs tabular-nums">{c.startPage}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Search({ book, go }: PanelProps) {
  const [pages, setPages] = useState<{ page: number; text: string }[] | null>(null)
  const [query, setQuery] = useState('')
  const id = useId()
  useEffect(() => {
    void loadAllPages(book.id).then(setPages)
  }, [book.id])
  const hits: SearchHit[] = pages ? searchPages(pages, query) : []
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={id} className="sr-only">
        Testo da cercare
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputClass}
        placeholder="Parola o frase"
      />
      {query.trim().length >= 2 && (
        <p className="text-sm text-[var(--fg-quiet)]" aria-live="polite">
          {hits.length === 0
            ? 'Nessun risultato.'
            : `${hits.length}${hits.length === 50 ? '+' : ''} risultati`}
        </p>
      )}
      <ul className="flex flex-col">
        {hits.map((h) => (
          <li key={`${h.page}-${h.index}`}>
            <button
              type="button"
              onClick={() => go(h.page)}
              className="flex w-full flex-col gap-1 border-t border-[var(--rule)] py-3 text-left"
            >
              <span className="text-xs text-[var(--fg-quiet)]">Pagina {h.page}</span>
              <span className="text-sm">
                …{h.before}
                <mark className="bg-[var(--rule)] text-[var(--fg)]">{h.match}</mark>
                {h.after}…
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Glossary({ book, glossaryTerm, glossaryContext }: PanelProps) {
  const { prefs } = useStore()
  const [term, setTerm] = useState(glossaryTerm)
  const [seen, setSeen] = useState<number | null>(null)
  const [ai, setAi] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; text: string }>({
    state: 'idle',
    text: '',
  })
  const id = useId()
  const entries: GlossaryEntry[] = lookup(term)

  useEffect(() => {
    if (glossaryTerm.trim()) void countLookup(glossaryTerm).then(setSeen)
  }, [glossaryTerm])

  const explain = async () => {
    if (!prefs.ai.apiKey) return
    setAi({ state: 'busy', text: '' })
    try {
      const text = await generate(
        prefs.ai.apiKey,
        prefs.ai.model,
        buildContextPrompt(term, glossaryContext, book.language),
        {
          maxOutputTokens: 300,
        },
      )
      setAi({ state: 'done', text })
    } catch (e) {
      setAi({
        state: 'error',
        text: e instanceof AiError ? e.message : 'Qualcosa non ha funzionato.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={id} className="sr-only">
        Termine
      </label>
      <input
        id={id}
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className={inputClass}
      />
      {seen !== null && seen > 1 && (
        <p className="text-sm text-[var(--fg-quiet)]">
          Hai cercato questo termine {seen} volte: lo aggiungo tra i punti da ripassare.
        </p>
      )}
      {entries.length === 0 ? (
        <p className="text-[var(--fg-quiet)]">Non è nel glossario.</p>
      ) : (
        <dl className="flex flex-col gap-4">
          {entries.map((e) => (
            <div key={e.en} className="flex flex-col gap-1 border-t border-[var(--rule)] pt-3">
              <dt>
                <span lang="it">{e.it}</span>
                <span className="text-[var(--fg-quiet)]">
                  {' '}
                  · <span lang="en">{e.en}</span>
                  {e.abbr ? ` · ${e.abbr}` : ''}
                </span>
              </dt>
              <dd className="text-sm text-[var(--fg-quiet)]">{e.def}</dd>
            </div>
          ))}
        </dl>
      )}
      {glossaryContext && prefs.ai.apiKey && (
        <div className="flex flex-col gap-3 border-t border-[var(--rule)] pt-4">
          <QuietButton
            onClick={explain}
            disabled={ai.state === 'busy' || !term.trim()}
            className="self-start text-[var(--fg)] underline"
          >
            {ai.state === 'busy' ? 'Chiedo…' : 'Spiega in questa frase (IA)'}
          </QuietButton>
          <p className="text-xs text-[var(--fg-quiet)]">
            Invia a Google solo il termine e la frase in cui compare.
          </p>
          {ai.text && (
            <p
              className={ai.state === 'error' ? 'text-sm' : 'text-sm leading-relaxed'}
              aria-live="polite"
            >
              {ai.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Notes({ book, highlights, go }: PanelProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  useEffect(() => {
    void loadDrawings(book.id).then((d) => setDrawings(d.filter((x) => x.strokes.length > 0)))
  }, [book.id])
  const items = [
    ...highlights.map((h) => ({ kind: 'h' as const, page: h.page, order: h.start, h })),
    ...drawings.map((d) => ({ kind: 'd' as const, page: d.page, order: -1, d })),
  ].sort((a, b) => a.page - b.page || a.order - b.order)
  if (items.length === 0)
    return (
      <p className="text-[var(--fg-quiet)]">
        Seleziona del testo e scegli Evidenzia o Nota, oppure scrivi a penna in vista pagina.
      </p>
    )
  return (
    <ul className="flex flex-col">
      {items.map((it) => (
        <li key={it.kind === 'h' ? it.h.id : it.d.id}>
          <button
            type="button"
            onClick={() => go(it.page)}
            className="flex w-full flex-col gap-1 border-t border-[var(--rule)] py-3 text-left"
          >
            <span className="text-xs text-[var(--fg-quiet)]">Pagina {it.page}</span>
            {it.kind === 'h' ? (
              <>
                <span className="text-sm">
                  “{it.h.quote.length > 200 ? `${it.h.quote.slice(0, 200)}…` : it.h.quote}”
                </span>
                {it.h.note && <span className="text-sm text-[var(--fg-quiet)]">{it.h.note}</span>}
              </>
            ) : (
              <span className="whitespace-pre-line text-sm">
                {it.d.transcript ?? `Note a penna (${it.d.strokes.length} tratti)`}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

function HighlightEditor({
  activeHighlight: h,
  updateHighlight,
  removeHighlight,
  close,
}: PanelProps) {
  const [note, setNote] = useState(h?.note ?? '')
  const id = useId()
  if (!h) return null
  return (
    <div className="flex flex-col gap-4">
      <blockquote className="border-l border-[var(--rule)] pl-4 text-sm">{h.quote}</blockquote>
      <label htmlFor={id} className="text-sm">
        Nota
      </label>
      <textarea
        id={id}
        rows={5}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] p-3 text-[var(--fg)]"
      />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          onClick={async () => {
            await updateHighlight({ ...h, note: note.trim() || null })
            close()
          }}
        >
          Salva
        </PrimaryButton>
        <QuietButton onClick={() => removeHighlight(h.id)}>Rimuovi evidenziazione</QuietButton>
      </div>
    </div>
  )
}

function ToolPicker() {
  const [toolId, setToolId] = useState('calcolatrice')
  const tool = tools.find((t) => t.id === toolId) ?? tools[0]
  const Current = tool.component
  const id = useId()
  return (
    <div className="flex flex-col gap-6">
      <label htmlFor={id} className="sr-only">
        Strumento
      </label>
      <select
        id={id}
        value={toolId}
        onChange={(e) => setToolId(e.target.value)}
        className={inputClass}
      >
        {tools.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Current />
    </div>
  )
}

type GenState =
  | { step: 'form' }
  | { step: 'busy' }
  | { step: 'preview'; concepts: UserConcept[]; rejected: number; chosen: Set<string> }
  | { step: 'saved'; count: number }
  | { step: 'error'; message: string }

function Generate({ book, page }: PanelProps) {
  const { prefs, course, addConcepts } = useStore()
  const chapter = book.chapters.find((c) => page >= c.startPage && page <= c.endPage)
  const [from, setFrom] = useState(chapter?.startPage ?? page)
  const [to, setTo] = useState(chapter ? Math.min(chapter.endPage, chapter.startPage + 9) : page)
  const [count, setCount] = useState(5)
  const [state, setState] = useState<GenState>({ step: 'form' })
  const ids = { from: useId(), to: useId(), count: useId() }

  if (!prefs.ai.apiKey) {
    return (
      <div className="flex flex-col gap-4">
        <p>Per creare domande dal libro serve la tua chiave Google AI Studio.</p>
        <QuietLink href={hrefFor({ name: 'settings' })}>Apri le impostazioni</QuietLink>
      </div>
    )
  }

  const run = async () => {
    const a = Math.max(1, Math.min(from, to))
    const b = Math.min(book.pageCount, Math.max(from, to))
    setState({ step: 'busy' })
    try {
      const pages = await loadPages(book.id, a, b)
      const text = pages.map((p) => p.text).join('\n\n')
      if (text.trim().length < 200) {
        setState({ step: 'error', message: 'Queste pagine hanno troppo poco testo.' })
        return
      }
      const raw = await generate(
        prefs.ai.apiKey as string,
        prefs.ai.model,
        buildQuestionsPrompt({
          bookTitle: book.title,
          fromPage: a,
          toPage: b,
          text,
          subjects: course.subjects,
          count,
          language: book.language,
        }),
        { json: true, maxOutputTokens: 8192, temperature: 0.3 },
      )
      const result = parseGenerated(extractJson(raw), {
        subjects: course.subjects,
        fallbackSubjectId: book.subjectId ?? course.subjects[0]?.id ?? 'law',
        origin: {
          bookId: book.id,
          bookTitle: book.title,
          fromPage: a,
          toPage: b,
          createdAt: new Date().toISOString(),
        },
        makeId: () => crypto.randomUUID(),
      })
      if (result.concepts.length === 0) {
        setState({
          step: 'error',
          message: 'La risposta non conteneva domande valide. Riprova o scegli altre pagine.',
        })
        return
      }
      setState({
        step: 'preview',
        concepts: result.concepts,
        rejected: result.rejected,
        chosen: new Set(result.concepts.map((c) => c.id)),
      })
    } catch (e) {
      setState({
        step: 'error',
        message:
          e instanceof AiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Qualcosa non ha funzionato.',
      })
    }
  }

  if (state.step === 'preview') {
    const toggle = (id: string) => {
      const chosen = new Set(state.chosen)
      if (chosen.has(id)) chosen.delete(id)
      else chosen.add(id)
      setState({ ...state, chosen })
    }
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--fg-quiet)]">
          Controlla ogni concetto prima di aggiungerlo: l’IA può sbagliare.
          {state.rejected > 0 ? ` Ho scartato ${state.rejected} domande incomplete.` : ''}
        </p>
        <ul className="flex flex-col">
          {state.concepts.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 border-t border-[var(--rule)] py-3">
              <label className="flex min-h-11 items-start gap-3">
                <input
                  type="checkbox"
                  checked={state.chosen.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="mt-1 size-4 accent-[var(--fg)]"
                />
                <span className="flex flex-col gap-1">
                  <span>{c.title}</span>
                  <span className="text-xs text-[var(--fg-quiet)]">
                    {course.subjects.find((s) => s.id === c.subjectId)?.name} · {c.variants.length}{' '}
                    formulazioni
                  </span>
                </span>
              </label>
              <details className="pl-7 text-sm">
                <summary className="cursor-pointer text-[var(--fg-quiet)]">Vedi le domande</summary>
                <ul className="mt-2 flex flex-col gap-3">
                  {c.variants.map((v) => (
                    <li key={v.id}>
                      <p>{v.prompt}</p>
                      <p className="text-[var(--fg-quiet)]">Risposta: {v.answer}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            disabled={state.chosen.size === 0}
            onClick={() => {
              const chosen = state.concepts.filter((c) => state.chosen.has(c.id))
              addConcepts(chosen)
              setState({ step: 'saved', count: chosen.length })
            }}
          >
            Aggiungi {state.chosen.size} al corso
          </PrimaryButton>
          <QuietButton onClick={() => setState({ step: 'form' })}>Scarta</QuietButton>
        </div>
      </div>
    )
  }

  if (state.step === 'saved') {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <p>Aggiunti {state.count} concetti. Entreranno nelle prossime sessioni di studio.</p>
        <QuietButton className="self-start" onClick={() => setState({ step: 'form' })}>
          Crea altre domande
        </QuietButton>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--fg-quiet)]">
        Il testo delle pagine scelte viene inviato a Google con la tua chiave. Le domande verificano
        la comprensione, con più formulazioni per concetto.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.from} className="text-sm">
            Da pagina
          </label>
          <input
            id={ids.from}
            type="number"
            min={1}
            max={book.pageCount}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.to} className="text-sm">
            A pagina
          </label>
          <input
            id={ids.to}
            type="number"
            min={1}
            max={book.pageCount}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.count} className="text-sm">
            Concetti
          </label>
          <input
            id={ids.count}
            type="number"
            min={1}
            max={15}
            value={count}
            onChange={(e) => setCount(Math.min(15, Math.max(1, Number(e.target.value))))}
            className={inputClass}
          />
        </div>
      </div>
      <PrimaryButton onClick={run} disabled={state.step === 'busy'} className="self-start">
        {state.step === 'busy' ? 'Genero…' : 'Genera'}
      </PrimaryButton>
      {state.step === 'error' && (
        <p className="text-sm" aria-live="polite">
          {state.message}
        </p>
      )}
    </div>
  )
}
