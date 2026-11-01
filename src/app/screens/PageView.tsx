import { useEffect, useRef, useState } from 'react'
import { loadBookFile } from '../data/db'
import type { OpenPdf } from '../reading/pdf'

/** The original PDF page, rendered to a canvas. Kept open while the reader stays on this book. */
const cache = new Map<string, Promise<OpenPdf | null>>()

function openBook(bookId: string): Promise<OpenPdf | null> {
  let p = cache.get(bookId)
  if (!p) {
    p = (async () => {
      const blob = await loadBookFile(bookId)
      if (!blob) return null
      const { openPdf } = await import('../reading/pdf')
      return openPdf(await blob.arrayBuffer())
    })()
    // Only one book stays open at a time.
    for (const [id, other] of cache) {
      if (id !== bookId) void other.then((o) => o?.close())
    }
    cache.clear()
    cache.set(bookId, p)
  }
  return p
}

export function PageView({ bookId, page }: { bookId: string; page: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    void (async () => {
      try {
        const pdf = await openBook(bookId)
        if (cancelled) return
        if (!pdf) {
          setError('Il file originale non è salvato su questo dispositivo.')
          return
        }
        const canvas = canvasRef.current
        const width = wrapRef.current?.clientWidth ?? 720
        if (!canvas) return
        const { renderPage } = await import('../reading/pdf')
        await renderPage(pdf.doc, page, canvas, width)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, page])

  return (
    <div ref={wrapRef} className="w-full">
      {error ? (
        <p className="text-[var(--fg-quiet)]">{error}</p>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`Pagina ${page} del PDF originale`}
          role="img"
          className="max-w-full bg-white"
        />
      )}
    </div>
  )
}
