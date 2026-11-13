/** Pure geometry for the camera models: head angles, the face area, smoothing for drawing. */

export interface Point {
  x: number
  y: number
  z?: number
}

const degrees = (rad: number) => (rad * 180) / Math.PI

/** Head angles from the 4×4 column-major face transformation matrix. */
export function headAngles(m: ArrayLike<number>): { yaw: number; pitch: number } {
  const r20 = m[2] ?? 0
  const r21 = m[6] ?? 0
  const r22 = m[10] ?? 1
  return {
    yaw: degrees(Math.asin(Math.max(-1, Math.min(1, -r20)))),
    pitch: degrees(Math.atan2(r21, r22)),
  }
}

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Bounding box of the face, normalised, grown a little to include the chin and cheeks. */
export function faceBox(points: readonly Point[]): Box | null {
  if (points.length === 0) return null
  let x0 = 1
  let x1 = 0
  let y0 = 1
  let y1 = 0
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  const padX = (x1 - x0) * 0.2
  const padY = (y1 - y0) * 0.35
  return { x0: x0 - padX, x1: x1 + padX, y0: y0 - padY, y1: y1 + padY }
}

/** A hand rests on the face when its wrist or palm sits inside the face area. */
export function handOnFace(hands: readonly (readonly Point[])[], box: Box | null): boolean {
  if (!box) return false
  return hands.some((h) =>
    [0, 5, 9, 13].some((i) => {
      const p = h[i]
      return !!p && p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1
    }),
  )
}

/** Shoulder height (0 top, 1 bottom) from pose landmarks 11 and 12, when both are visible. */
export function shoulderHeight(
  pose: readonly (Point & { visibility?: number })[] | null,
): number | null {
  const l = pose?.[11]
  const r = pose?.[12]
  if (!l || !r || (l.visibility ?? 1) < 0.5 || (r.visibility ?? 1) < 0.5) return null
  return (l.y + r.y) / 2
}

/**
 * Moves drawn points a share of the way towards the latest detection each screen frame, so the
 * mesh glides instead of jumping between analyses. A new set of a different size snaps.
 */
export function glide(drawn: Point[] | null, target: readonly Point[], share: number): Point[] {
  if (!drawn || drawn.length !== target.length) return target.map((p) => ({ x: p.x, y: p.y }))
  return drawn.map((p, i) => {
    const t = target[i] ?? p
    return { x: p.x + (t.x - p.x) * share, y: p.y + (t.y - p.y) * share }
  })
}

/** Exponential smoothing for readings shown to the learner. */
export function ease(previous: number | null, next: number, share: number): number {
  return previous === null ? next : previous + (next - previous) * share
}
