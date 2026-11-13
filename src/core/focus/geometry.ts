/** Pure geometry for the camera: head angles, and smoothing for the calibration view. */

export interface Point {
  x: number
  y: number
}

const degrees = (rad: number) => (rad * 180) / Math.PI

/** Head angles from the 4×4 column-major face transformation matrix. */
export function headAngles(m: ArrayLike<number>): { yaw: number; pitch: number; roll: number } {
  const r00 = m[0] ?? 1
  const r10 = m[1] ?? 0
  const r20 = m[2] ?? 0
  const r21 = m[6] ?? 0
  const r22 = m[10] ?? 1
  return {
    yaw: degrees(Math.asin(Math.max(-1, Math.min(1, -r20)))),
    pitch: degrees(Math.atan2(r21, r22)),
    roll: degrees(Math.atan2(r10, r00)),
  }
}

/**
 * Moves drawn points a share of the way towards the latest detection each screen frame, so the
 * mesh glides instead of jumping between analyses. A set of a different size snaps.
 */
export function glide(drawn: Point[] | null, target: readonly Point[], share: number): Point[] {
  if (!drawn || drawn.length !== target.length) return target.map((p) => ({ x: p.x, y: p.y }))
  return drawn.map((p, i) => {
    // Same length, checked above.
    const t = target[i] as Point
    return { x: p.x + (t.x - p.x) * share, y: p.y + (t.y - p.y) * share }
  })
}
