import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { msg } from '../../core/i18n'
import {
  bounds,
  buildTranscribePrompt,
  hitStroke,
  MARKER_WIDTH,
  PEN_WIDTH,
  type Point,
  type Stroke,
  strokePath,
  thin,
} from '../../core/ink'
import { AiError, generate } from '../ai/gemini'
import { type Drawing, loadBookFile, loadDrawing, saveDrawing } from '../data/db'
import { t } from '../i18n'
import type { OpenPdf } from '../reading/pdf'
import { useStore } from '../state'
import { QuietButton } from '../ui'

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

type Tool = 'none' | 'pen' | 'marker' | 'eraser'

const toolLabel: Record<Exclude<Tool, 'none'>, string> = {
  pen: msg('Penna'),
  marker: msg('Evidenziatore'),
  eraser: msg('Gomma'),
}

export function PageView({
  bookId,
  page,
  language,
}: {
  bookId: string
  page: number
  language: 'it' | 'en'
}) {
  const { prefs, exam } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [drawing, setDrawing] = useState<Drawing | null>(null)
  const [tool, setTool] = useState<Tool>('none')
  const [live, setLive] = useState<Stroke | null>(null)
  const [undo, setUndo] = useState<Stroke[][]>([])
  const [transcribing, setTranscribing] = useState<string | null>(null)
  const penSeen = useRef(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setSize(null)
    void loadDrawing(bookId, page).then((d) => {
      if (!cancelled) setDrawing(d ?? null)
    })
    void (async () => {
      try {
        const pdf = await openBook(bookId)
        if (cancelled) return
        if (!pdf) {
          setError(t('Il file originale non è salvato su questo dispositivo.'))
          return
        }
        const canvas = canvasRef.current
        const width = wrapRef.current?.clientWidth ?? 720
        if (!canvas) return
        const { renderPage } = await import('../reading/pdf')
        const s = await renderPage(pdf.doc, page, canvas, width)
        if (!cancelled) setSize(s)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, page])

  const strokes = drawing?.strokes ?? []

  const commit = (next: Stroke[], transcript?: string) => {
    const d: Drawing = {
      id: drawing?.id ?? `${bookId}:${page}`,
      bookId,
      page,
      strokes: next,
      ...((transcript ?? drawing?.transcript) !== undefined
        ? { transcript: (transcript ?? drawing?.transcript) as string }
        : {}),
      updatedAt: new Date().toISOString(),
    }
    setDrawing(d)
    void saveDrawing(d)
  }

  const toPoint = (e: React.PointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return [
      (e.clientX - r.left) / r.width,
      (e.clientY - r.top) / r.width,
      e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5,
    ]
  }

  const erase = (p: Point) => {
    const i = hitStroke(strokes, p[0], p[1], 0.01)
    if (i >= 0) {
      setUndo((u) => [...u, strokes])
      commit(strokes.filter((_, j) => j !== i))
    }
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'none') return
    // Palm rejection: once a pen has been used, fingers don't draw.
    if (e.pointerType === 'pen') penSeen.current = true
    else if (e.pointerType === 'touch' && penSeen.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toPoint(e)
    if (tool === 'eraser') return erase(p)
    setLive({
      points: [p],
      width: tool === 'marker' ? MARKER_WIDTH : PEN_WIDTH,
      kind: tool === 'marker' ? 'marker' : 'pen',
    })
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'eraser' && e.buttons) return erase(toPoint(e))
    if (!live) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    const r = e.currentTarget.getBoundingClientRect()
    const pts: Point[] = events.map((ev) => [
      (ev.clientX - r.left) / r.width,
      (ev.clientY - r.top) / r.width,
      ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5,
    ])
    setLive({ ...live, points: [...live.points, ...pts] })
  }
  const onUp = () => {
    if (!live) return
    setUndo((u) => [...u, strokes])
    commit([...strokes, { ...live, points: thin(live.points) }])
    setLive(null)
  }

  /** Renders only the handwriting (not the book page) to send for transcription. */
  const transcribe = async () => {
    const apiKey = prefs.ai.apiKey
    const box = bounds(strokes)
    if (!apiKey || !box) return
    setTranscribing(t('Leggo la tua scrittura…'))
    try {
      const W = 1400
      const c = document.createElement('canvas')
      c.width = Math.ceil((box.right - box.x) * W)
      c.height = Math.ceil((box.bottom - box.y) * W)
      const ctx = c.getContext('2d')
      if (!ctx) throw new Error(t('Canvas non disponibile.'))
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.translate(-box.x * W, -box.y * W)
      for (const s of strokes) {
        ctx.fillStyle = s.kind === 'marker' ? 'rgba(0,0,0,0.25)' : '#000'
        ctx.fill(new Path2D(strokePath(s, W)))
      }
      const base64 = c.toDataURL('image/png').split(',')[1] ?? ''
      const text = await generate(
        apiKey,
        prefs.ai.model,
        buildTranscribePrompt(language, exam.name),
        {
          inline: { mimeType: 'image/png', base64 },
          maxOutputTokens: 1200,
          temperature: 0,
        },
      )
      commit(strokes, text)
      setTranscribing(null)
    } catch (e) {
      setTranscribing(e instanceof AiError ? e.message : t('Trascrizione non riuscita.'))
    }
  }

  const w = size?.width ?? 0
  return (
    <div className="flex w-full flex-col gap-4">
      {!error && (
        <div
          role="toolbar"
          aria-label={t('Note a penna')}
          className="flex flex-wrap items-center gap-1 text-sm"
        >
          {(Object.keys(toolLabel) as (keyof typeof toolLabel)[]).map((tl) => (
            <QuietButton
              key={tl}
              aria-pressed={tool === tl}
              className={tool === tl ? 'text-[var(--fg)] underline' : ''}
              onClick={() => setTool(tool === tl ? 'none' : tl)}
            >
              {t(toolLabel[tl])}
            </QuietButton>
          ))}
          <QuietButton
            disabled={undo.length === 0}
            onClick={() => {
              const prev = undo[undo.length - 1]
              if (!prev) return
              setUndo((u) => u.slice(0, -1))
              commit(prev)
            }}
          >
            {t('Annulla')}
          </QuietButton>
          {strokes.length > 0 && prefs.ai.apiKey && (
            <QuietButton
              onClick={transcribe}
              disabled={transcribing === t('Leggo la tua scrittura…')}
            >
              {t('Trascrivi in testo (IA)')}
            </QuietButton>
          )}
        </div>
      )}
      <div ref={wrapRef} className="relative w-full">
        {error ? (
          <p className="text-[var(--fg-quiet)]">{error}</p>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              aria-label={t('Pagina {page} del PDF originale', { page })}
              role="img"
              className="block max-w-full bg-white"
            />
            {size && (
              <svg
                aria-hidden="true"
                className="absolute top-0 left-0"
                width={w}
                height={size.height}
                viewBox={`0 0 ${w} ${size.height}`}
                style={{
                  touchAction: tool === 'none' ? 'auto' : 'none',
                  pointerEvents: tool === 'none' ? 'none' : 'auto',
                  cursor: tool === 'none' ? 'default' : 'crosshair',
                }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                {[...strokes, ...(live ? [live] : [])].map((s, i) => (
                  <path
                    // Strokes never reorder; position is their identity.
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above
                    key={i}
                    d={strokePath(s, w)}
                    fill={s.kind === 'marker' ? 'rgba(0,0,0,0.22)' : '#111'}
                  />
                ))}
              </svg>
            )}
          </>
        )}
      </div>
      {transcribing && (
        <p className="text-sm" aria-live="polite">
          {transcribing}
        </p>
      )}
      {drawing?.transcript && (
        <section className="flex flex-col gap-2 border-l border-[var(--rule)] pl-4">
          <h2 className="text-xs text-[var(--fg-quiet)]">
            {t('Le tue note a penna, in testo (verificale)')}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{drawing.transcript}</p>
        </section>
      )}
    </div>
  )
}
