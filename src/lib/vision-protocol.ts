/** Messages between the page and the vision worker (ADR 0009). */
import type { FrameSample } from '../core/focus/focus'
import type { Point } from '../core/focus/geometry'

export type VisionRequest =
  | { type: 'init'; base: string; extras: boolean }
  | { type: 'frame'; frame: ImageBitmap; time: number; draw: boolean }
  | { type: 'stop' }

export interface Connections {
  tesselation: [number, number][]
  oval: [number, number][]
  eyes: [number, number][]
  irises: [number, number][]
  lips: [number, number][]
  pose: [number, number][]
  hand: [number, number][]
}

/** Points to draw in the live view, normalised 0–1. Sent only while a view is open. */
export interface DrawData {
  face: Point[] | null
  pose: Point[] | null
  hands: Point[][]
  phone: { x: number; y: number; w: number; h: number } | null
}

export type VisionReply =
  | {
      type: 'ready'
      connections: Connections
      /** Which extra models loaded (one that fails simply stays off). */
      loaded: { pose: boolean; objects: boolean; hands: boolean }
    }
  | { type: 'failed' }
  | { type: 'result'; cost: number; sample: Omit<FrameSample, 't'>; draw: DrawData | null }
