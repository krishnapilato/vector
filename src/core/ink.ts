/**
 * Pen notes on book pages. Strokes are stored as vectors in page-relative coordinates
 * (0..1 of the page width), so they fit any screen size and never contain an image.
 */
import { getStroke } from 'perfect-freehand'

export type Point = [x: number, y: number, pressure: number]

export interface Stroke {
  points: Point[]
  /** Relative to the page width. */
  width: number
  kind?: 'pen' | 'marker'
}

export const PEN_WIDTH = 0.004
export const MARKER_WIDTH = 0.018

/** SVG path of a stroke, drawn at the given page width in pixels. */
export function strokePath(stroke: Stroke, pageWidth: number): string {
  const pts = stroke.points.map(([x, y, p]) => [x * pageWidth, y * pageWidth, p] as const)
  const outline = getStroke(
    pts.map((p) => [p[0], p[1], p[2]]),
    {
      size: stroke.width * pageWidth,
      thinning: stroke.kind === 'marker' ? 0 : 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: pts.every((p) => p[2] === 0.5),
      last: true,
    },
  )
  if (outline.length < 2) return ''
  const r = (n: number) => Math.round(n * 100) / 100
  const [first, ...rest] = outline
  return `M${r(first?.[0] ?? 0)},${r(first?.[1] ?? 0)}${rest.map(([x, y]) => `L${r(x ?? 0)},${r(y ?? 0)}`).join('')}Z`
}

function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len))
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy))
}

/** Index of the topmost stroke within `radius` of the point, or -1. */
export function hitStroke(
  strokes: readonly Stroke[],
  x: number,
  y: number,
  radius: number,
): number {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i] as Stroke
    const reach = radius + s.width / 2
    if (s.points.length === 1) {
      const p = s.points[0] as Point
      if (Math.hypot(p[0] - x, p[1] - y) <= reach) return i
      continue
    }
    for (let j = 1; j < s.points.length; j++) {
      if (distToSegment(x, y, s.points[j - 1] as Point, s.points[j] as Point) <= reach) return i
    }
  }
  return -1
}

/** Drops points closer than `min` to the previous one: smaller storage, same drawing. */
export function thin(points: readonly Point[], min = 0.0015): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= min) out.push(p)
  }
  const end = points[points.length - 1]
  if (end && out[out.length - 1] !== end) out.push(end)
  return out
}

/** Bounding box of all strokes, relative units, with a margin; null when empty. */
export function bounds(strokes: readonly Stroke[], margin = 0.02) {
  const pts = strokes.flatMap((s) => s.points)
  if (pts.length === 0) return null
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return {
    x: Math.max(0, Math.min(...xs) - margin),
    y: Math.max(0, Math.min(...ys) - margin),
    right: Math.max(...xs) + margin,
    bottom: Math.max(...ys) + margin,
  }
}

export function buildTranscribePrompt(language: 'it' | 'en', examName = 'PPL(A)'): string {
  return [
    `L’immagine contiene appunti scritti a mano da uno studente (${examName}) su una pagina di un manuale` +
      (language === 'en' ? ' in inglese' : '') +
      '.',
    'Trascrivi fedelmente il testo scritto a mano, riga per riga. Mantieni abbreviazioni, numeri e unità di misura così come sono.',
    'Se c’è uno schema o una freccia, descrivilo tra parentesi quadre in poche parole.',
    'Se una parola è illeggibile scrivi [?]. Non aggiungere spiegazioni né testo che non c’è.',
  ].join('\n')
}
