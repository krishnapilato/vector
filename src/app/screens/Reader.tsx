import type React from 'react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  type Book,
  chapterOf,
  type Highlight,
  normalizeSelection,
  segments,
} from '../../core/reading/book'
import { paragraphs } from '../../core/reading/text'
import { deleteHighlight, loadHighlights, loadPage, saveHighlight } from '../data/db'
import { hrefFor, navigate } from '../router'
import { useStore } from '../state'
import { QuietButton, QuietLink } from '../ui'

const Panels = lazy(() => import('./ReaderPanels').then((m) => ({ default: m.ReaderPanels })))
const PageView = lazy(() => import('./PageView').then((m) => ({ default: m.PageView })))

export type PanelKind = 'toc' | 'search' | 'glossary' | 'notes' | 'highlight' | 'generate' | 'tools'

const sizes = ['text-base', 'text-lg', 'text-xl', 'text-2xl'] as const

interface Selection {
  start: number
  end: number
  quote: string
  context: string
}

/** Study state: no menu. The text, a quiet header and the page controls. */
export function Reader({
  bookId,
  page,
  view,
}: {
  bookId: string
  page: number | null
  view: 'text' | 'page'
}) {
  const { books, putBook, prefs, updatePrefs } = useStore()
  const book = books.find((b) => b.id === bookId)
  if (!book) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
        <p>Libro non trovato.</p>
        <QuietLink href={hrefFor({ name: 'library' })}>Torna alla libreria</QuietLink>
      </main>
    )
  }
  const current = Math.min(Math.max(1, page ?? book.lastPage), book.pageCount)
  return (
    <ReaderBody
      key={book.id}
      book={book}
      page={current}
      view={view === 'page' && book.hasFile ? 'page' : 'text'}
      putBook={putBook}
      size={prefs.study.readingSize}
      setSize={(readingSize) => updatePrefs({ ...prefs, study: { ...prefs.study, readingSize } })}
    />
  )
}

function ReaderBody({
  book,
  page,
  view,
  putBook,
  size,
  setSize,
}: {
  book: Book
  page: number
  view: 'text' | 'page'
  putBook: (b: Book) => void
  size: number
  setSize: (s: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [panel, setPanel] = useState<PanelKind | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const [glossaryTerm, setGlossaryTerm] = useState('')
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    void loadHighlights(book.id).then(setHighlights)
  }, [book.id])

  // Load the page; remember where the learner is and what they have read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per page
  useEffect(() => {
    setText(null)
    setSelection(null)
    void loadPage(book.id, page).then((p) => setText(p?.text ?? ''))
    if (book.lastPage !== page || !book.readPages.includes(page)) {
      putBook({ ...book, lastPage: page, readPages: [...new Set([...book.readPages, page])] })
    }
    window.scrollTo(0, 0)
  }, [book.id, page])

  const go = useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), book.pageCount)
      navigate({ name: 'reader', bookId: book.id, page: target, view })
    },
    [book.id, book.pageCount, view],
  )

  const exit = () => navigate({ name: 'library' })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, select, textarea')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        if (panel) setPanel(null)
        else if (selection) setSelection(null)
        else exit()
      } else if (e.key === 'ArrowRight') go(page + 1)
      else if (e.key === 'ArrowLeft') go(page - 1)
      else if (e.key === '/') {
        e.preventDefault()
        setPanel('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /** Reads the browser selection as offsets into the page text. */
  const readSelection = (): Selection | null => {
    const sel = window.getSelection()
    const article = articleRef.current
    if (!sel || sel.isCollapsed || !article || text === null) return null
    const range = sel.getRangeAt(0)
    if (!article.contains(range.commonAncestorContainer)) return null
    const offsetOf = (node: Node, offset: number): number | null => {
      const para = (
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
      )?.closest<HTMLElement>('[data-offset]')
      if (!para) return null
      const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
      let count = 0
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n === node) return Number(para.dataset.offset) + count + offset
        count += n.textContent?.length ?? 0
      }
      return Number(para.dataset.offset) + (node === para ? count : 0)
    }
    const a = offsetOf(range.startContainer, range.startOffset)
    const b = offsetOf(range.endContainer, range.endOffset)
    if (a === null || b === null) return null
    const norm = normalizeSelection(text, a, b)
    if (!norm) return null
    const para = paragraphs(text).find(
      (p) => norm.start >= p.start && norm.start <= p.start + p.text.length,
    )
    return { ...norm, context: para?.text ?? norm.quote }
  }

  const onSelect = (e?: React.MouseEvent) => {
    const s = readSelection()
    // A plain click on a highlight opens it; dragging selects new text.
    const mark = (e?.target as HTMLElement | null)?.closest<HTMLElement>('mark[data-h]')
    if (!s && mark?.dataset.h) {
      setActiveHighlight(mark.dataset.h)
      setPanel('highlight')
      return
    }
    setSelection(s)
  }

  const addHighlight = async (note: string | null) => {
    if (!selection) return
    const h: Highlight = {
      id: crypto.randomUUID(),
      bookId: book.id,
      page,
      start: selection.start,
      end: selection.end,
      quote: selection.quote,
      note,
      createdAt: new Date().toISOString(),
    }
    await saveHighlight(h)
    setHighlights((hs) => [...hs, h])
    setSelection(null)
    window.getSelection()?.removeAllRanges()
    if (note !== null) {
      setActiveHighlight(h.id)
      setPanel('highlight')
    }
  }

  const updateHighlight = async (h: Highlight) => {
    await saveHighlight(h)
    setHighlights((hs) => hs.map((x) => (x.id === h.id ? h : x)))
  }
  const removeHighlight = async (id: string) => {
    await deleteHighlight(id)
    setHighlights((hs) => hs.filter((x) => x.id !== id))
    setPanel(null)
  }

  const chapter = chapterOf(book, page)
  const pageHighlights = highlights.filter((h) => h.page === page)
  const openGlossary = (term: string) => {
    setGlossaryTerm(term)
    setPanel('glossary')
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-px bg-[var(--rule)]" aria-hidden="true">
        <div
          className="h-px bg-[var(--fg)]"
          style={{ width: `${(page / book.pageCount) * 100}%` }}
        />
      </div>
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-6 pt-3">
        <h1 className="min-w-0 truncate text-xs font-normal text-[var(--fg-quiet)]">
          {book.title}
          {chapter ? ` · ${chapter.title}` : ''}
        </h1>
        <nav aria-label="Lettore" className="flex flex-wrap items-center">
          <QuietButton onClick={() => setPanel('toc')} aria-expanded={panel === 'toc'}>
            Indice
          </QuietButton>
          <QuietButton onClick={() => setPanel('search')} aria-expanded={panel === 'search'}>
            Cerca
          </QuietButton>
          <QuietButton onClick={() => setPanel('notes')} aria-expanded={panel === 'notes'}>
            Note
          </QuietButton>
          <QuietButton onClick={() => setPanel('generate')} aria-expanded={panel === 'generate'}>
            Crea domande
          </QuietButton>
          <QuietButton onClick={() => setPanel('tools')} aria-expanded={panel === 'tools'}>
            Strumenti
          </QuietButton>
          {book.hasFile && (
            <QuietButton
              onClick={() =>
                navigate({
                  name: 'reader',
                  bookId: book.id,
                  page,
                  view: view === 'page' ? 'text' : 'page',
                })
              }
            >
              {view === 'page' ? 'Vista testo' : 'Vista pagina'}
            </QuietButton>
          )}
          {view === 'text' && (
            <QuietButton
              onClick={() => setSize((size + 1) % sizes.length)}
              aria-label="Cambia la dimensione del testo"
            >
              Aa
            </QuietButton>
          )}
          <QuietButton onClick={exit}>Esci</QuietButton>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        {view === 'page' ? (
          <Suspense fallback={null}>
            <PageView bookId={book.id} page={page} />
          </Suspense>
        ) : text === null ? null : text.trim() === '' ? (
          <p className="text-[var(--fg-quiet)]">
            Questa pagina non contiene testo selezionabile
            {book.hasFile ? ': aprila in vista pagina.' : '.'}
          </p>
        ) : (
          <article
            ref={articleRef}
            lang={book.language}
            onMouseUp={onSelect}
            onKeyUp={() => onSelect()}
            onDoubleClick={() => {
              const s = readSelection()
              if (s && s.quote.split(/\s+/).length <= 4) {
                setSelection(s)
                openGlossary(s.quote)
              }
            }}
            className={`flex max-w-[68ch] flex-col gap-5 leading-relaxed ${sizes[size] ?? sizes[1]}`}
          >
            {paragraphs(text).map((p) => (
              <p key={p.start} data-offset={p.start}>
                {segments(text, p.start, p.start + p.text.length, pageHighlights).map((seg) =>
                  seg.highlightIds.length === 0 ? (
                    <span key={seg.start}>{seg.text}</span>
                  ) : (
                    <mark
                      key={seg.start}
                      data-h={seg.highlightIds[0]}
                      className={`cursor-pointer bg-[var(--rule)] text-[var(--fg)] ${
                        pageHighlights.some((h) => seg.highlightIds.includes(h.id) && h.note)
                          ? 'underline decoration-dotted underline-offset-4'
                          : ''
                      }`}
                    >
                      {seg.text}
                    </mark>
                  ),
                )}
              </p>
            ))}
          </article>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 pb-8">
        <QuietButton onClick={() => go(page - 1)} disabled={page <= 1}>
          ‹ Pagina precedente
        </QuietButton>
        <PageJump page={page} total={book.pageCount} go={go} />
        <QuietButton onClick={() => go(page + 1)} disabled={page >= book.pageCount}>
          Pagina successiva ›
        </QuietButton>
      </footer>

      {selection && !panel && (
        <div
          role="toolbar"
          aria-label="Selezione"
          className="fixed inset-x-0 bottom-24 z-10 mx-auto flex w-fit flex-wrap items-center gap-1 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-2"
        >
          <QuietButton className="text-[var(--fg)]" onClick={() => addHighlight(null)}>
            Evidenzia
          </QuietButton>
          <QuietButton onClick={() => addHighlight('')}>Nota</QuietButton>
          {selection.quote.split(/\s+/).length <= 4 && (
            <QuietButton onClick={() => openGlossary(selection.quote)}>Glossario</QuietButton>
          )}
          <QuietButton onClick={() => setSelection(null)}>Annulla</QuietButton>
        </div>
      )}

      {panel && (
        <Suspense fallback={null}>
          <Panels
            kind={panel}
            book={book}
            page={page}
            go={(p) => {
              go(p)
              setPanel(null)
            }}
            close={() => setPanel(null)}
            highlights={highlights}
            activeHighlight={highlights.find((h) => h.id === activeHighlight) ?? null}
            updateHighlight={updateHighlight}
            removeHighlight={removeHighlight}
            glossaryTerm={glossaryTerm}
            glossaryContext={selection?.context ?? ''}
          />
        </Suspense>
      )}
    </div>
  )
}

function PageJump({ page, total, go }: { page: number; total: number; go: (p: number) => void }) {
  const [draft, setDraft] = useState(String(page))
  useEffect(() => setDraft(String(page)), [page])
  return (
    <form
      className="flex items-center gap-2 text-sm text-[var(--fg-quiet)]"
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number(draft)
        if (Number.isInteger(n)) go(n)
      }}
    >
      <label className="sr-only" htmlFor="page-jump">
        Vai alla pagina
      </label>
      <input
        id="page-jump"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-11 w-16 rounded-lg border border-[var(--rule)] bg-transparent text-center tabular-nums text-[var(--fg)]"
      />
      <span>di {total}</span>
    </form>
  )
}
