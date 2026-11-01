import { useEffect, useId, useState } from 'react'
import { freeSources } from '../../core/content/sources'
import {
  type Book,
  chaptersFromOutline,
  type Reliability,
  readingProgress,
  reliabilityLabel,
} from '../../core/reading/book'
import { addBook, booksWithText, relinkBook } from '../data/db'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { Page, PrimaryButton, QuietButton } from '../ui'

const inputClass =
  'min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3 text-[var(--fg)]'

export function Library() {
  const { books, course } = useStore()
  const sorted = [...books].sort((a, b) => b.importedAt.localeCompare(a.importedAt))
  const [withText, setWithText] = useState<Set<string> | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check when the books change
  useEffect(() => {
    void booksWithText().then(setWithText)
  }, [books])

  return (
    <Page title="Libreria">
      {sorted.length > 0 ? (
        <ul className="flex flex-col">
          {sorted.map((b) => (
            <BookRow
              key={b.id}
              book={b}
              missing={withText !== null && !withText.has(b.id)}
              subjectName={course.subjects.find((s) => s.id === b.subjectId)?.name ?? null}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[var(--fg-quiet)]">
          Nessun libro ancora. Scarica una delle fonti gratuite qui sotto e importala: il testo
          resta solo su questo dispositivo.
        </p>
      )}

      <ImportForm />

      <section className="flex flex-col gap-4 border-t border-[var(--rule)] pt-6">
        <h2 className="text-lg font-medium">Fonti ufficiali gratuite</h2>
        <p className="text-sm text-[var(--fg-quiet)]">
          Si aprono in una nuova scheda: scarica il PDF e importalo qui sopra. ENAC non pubblica un
          manuale PPL e le domande d’esame ufficiali sono riservate.
        </p>
        <ul className="flex flex-col gap-4">
          {freeSources.map((s) => (
            <li key={s.url} className="flex flex-col gap-1">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {s.title}
              </a>
              <span className="text-sm text-[var(--fg-quiet)]">
                {s.publisher} · {s.language === 'it' ? 'italiano' : 'inglese'} · {s.note}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  )
}

function BookRow({
  book,
  subjectName,
  missing,
}: {
  book: Book
  subjectName: string | null
  missing: boolean
}) {
  const { removeBook, putBook } = useStore()
  const [relink, setRelink] = useState<string | null>(null)
  const fileId = useId()
  const attach = async (file: File) => {
    setRelink('Leggo il file…')
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf')
      const { importPdf, importText } = await import('../reading/pdf')
      const pages = isPdf
        ? (await importPdf(await file.arrayBuffer(), (d, t) => setRelink(`Pagina ${d} di ${t}…`)))
            .pages
        : importText(await file.text()).pages
      if (pages.length !== book.pageCount) {
        setRelink(
          `Questo file ha ${pages.length} pagine, il libro ${book.pageCount}: probabilmente è un altro file.`,
        )
        return
      }
      const next = { ...book, hasFile: isPdf }
      await relinkBook(next, pages, isPdf ? file : null)
      putBook(next)
      setRelink('Collegato.')
    } catch (e) {
      setRelink(`Non riuscito: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const [armed, setArmed] = useState(false)
  const progress = Math.round(readingProgress(book) * 100)
  return (
    <li className="flex flex-col gap-2 border-t border-[var(--rule)] py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={hrefFor({ name: 'reader', bookId: book.id, page: book.lastPage, view: 'text' })}
          className="text-lg underline-offset-4 hover:underline"
        >
          {book.title}
        </a>
        <span className="text-sm text-[var(--fg-quiet)]">letto {progress}%</span>
      </div>
      <p className="text-sm text-[var(--fg-quiet)]">
        {reliabilityLabel[book.reliability]} · {book.language === 'it' ? 'italiano' : 'inglese'} ·{' '}
        {book.pageCount} pagine · {book.chapters.length} capitoli
        {subjectName ? ` · ${subjectName}` : ''}
      </p>
      {missing && (
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor={fileId}>
            Il testo non è su questo dispositivo: ricollega lo stesso file.
          </label>
          <input
            id={fileId}
            type="file"
            accept="application/pdf,.pdf,.txt,.md"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void attach(f)
            }}
            className="text-sm file:mr-4 file:min-h-11 file:rounded-lg file:border file:border-[var(--rule)] file:bg-transparent file:px-4 file:text-[var(--fg)]"
          />
          {relink && <p aria-live="polite">{relink}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <a
          href={hrefFor({ name: 'reader', bookId: book.id, page: book.lastPage, view: 'text' })}
          className="inline-flex min-h-11 items-center pr-3 text-sm underline underline-offset-4"
        >
          {book.lastPage > 1 ? `Riprendi da pagina ${book.lastPage}` : 'Inizia a leggere'}
        </a>
        {armed ? (
          <>
            <QuietButton className="text-[var(--fg)] underline" onClick={() => removeBook(book.id)}>
              Conferma: elimina il libro e le sue evidenziazioni
            </QuietButton>
            <QuietButton onClick={() => setArmed(false)}>Annulla</QuietButton>
          </>
        ) : (
          <QuietButton onClick={() => setArmed(true)}>Elimina</QuietButton>
        )}
      </div>
    </li>
  )
}

function ImportForm() {
  const { putBook, course } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<'it' | 'en'>('en')
  const [reliability, setReliability] = useState<Reliability>('official')
  const [subjectId, setSubjectId] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = { file: useId(), title: useId(), lang: useId(), rel: useId(), subj: useId() }

  const run = async () => {
    if (!file) return
    setBusy(true)
    setStatus('Leggo il file…')
    try {
      const id = crypto.randomUUID()
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const { importPdf, importText } = await import('../reading/pdf')
      let pages: string[]
      let chapters: Book['chapters']
      let detectedTitle: string | null = null
      if (isPdf) {
        const r = await importPdf(await file.arrayBuffer(), (done, total) =>
          setStatus(`Importo la pagina ${done} di ${total}…`),
        )
        pages = r.pages
        chapters = r.chapters
        detectedTitle = r.title
      } else {
        pages = importText(await file.text()).pages
        chapters = chaptersFromOutline([], pages.length)
      }
      const empty = pages.filter((p) => p.trim().length < 20).length
      const book: Book = {
        id,
        title: title.trim() || detectedTitle || file.name.replace(/\.[^.]+$/, ''),
        language,
        reliability,
        subjectId: subjectId || null,
        pageCount: pages.length,
        chapters,
        hasFile: isPdf,
        importedAt: new Date().toISOString(),
        lastPage: 1,
        readPages: [],
      }
      await addBook(book, pages, isPdf ? file : null)
      putBook(book)
      setStatus(
        `Importato: ${book.pageCount} pagine, ${book.chapters.length} capitoli.` +
          (empty > pages.length / 2
            ? ' Molte pagine sono senza testo: probabilmente il PDF è scansionato. Puoi leggerlo in vista pagina.'
            : ''),
      )
      setFile(null)
      setTitle('')
    } catch (e) {
      setStatus(`Importazione non riuscita: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 border-t border-[var(--rule)] pt-6">
      <h2 className="text-lg font-medium">Importa un libro</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.file} className="text-sm">
          File PDF, testo o Markdown
        </label>
        <input
          id={ids.file}
          type="file"
          accept="application/pdf,.pdf,.txt,.md,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-4 file:min-h-11 file:rounded-lg file:border file:border-[var(--rule)] file:bg-transparent file:px-4 file:text-[var(--fg)]"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.title} className="text-sm">
            Titolo (facoltativo)
          </label>
          <input
            id={ids.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.lang} className="text-sm">
            Lingua
          </label>
          <select
            id={ids.lang}
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'it' | 'en')}
            className={inputClass}
          >
            <option value="en">Inglese</option>
            <option value="it">Italiano</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.rel} className="text-sm">
            Affidabilità
          </label>
          <select
            id={ids.rel}
            value={reliability}
            onChange={(e) => setReliability(e.target.value as Reliability)}
            className={inputClass}
          >
            {(Object.keys(reliabilityLabel) as Reliability[]).map((r) => (
              <option key={r} value={r}>
                {reliabilityLabel[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.subj} className="text-sm">
            Materia
          </label>
          <select
            id={ids.subj}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={inputClass}
          >
            <option value="">Più materie</option>
            {course.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PrimaryButton onClick={run} disabled={!file || busy}>
          Importa
        </PrimaryButton>
        {status && (
          <p className="text-sm" aria-live="polite">
            {status}
          </p>
        )}
      </div>
    </section>
  )
}
