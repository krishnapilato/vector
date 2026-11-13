/** Messages between the page and the vision worker (ADR 0009). */
import type { FrameSample } from '../core/focus/focus'
import type { Point } from '../core/focus/geometry'

export type VisionRequest =
  | { type: 'init'; base: string }
  | { type: 'frame'; frame: ImageBitmap; time: number; draw: boolean }
  | { type: 'stop' }

/** Face mesh connections, sent once so the page never loads MediaPipe itself. */
export interface Connections {
  tesselation: [number, number][]
  oval: [number, number][]
  eyes: [number, number][]
  irises: [number, number][]
  lips: [number, number][]
}

export type VisionReply =
  | { type: 'ready'; connections: Connections }
  | { type: 'failed' }
  | {
      type: 'result'
      cost: number
      sample: Omit<FrameSample, 'timestamp'>
      /** Face points, normalised 0–1, only while a calibration view is open. */
      face: Point[] | null
    }
