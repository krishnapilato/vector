/**
 * The camera adapter (PIANO-V3-LITE §5.1, ported from v2 src/app/focus/sensors.ts).
 * The page only grabs 320×240 frames at 6 fps; Face Landmarker runs in a Web Worker (ADR 0009).
 * Frames are analysed in memory and dropped at once: nothing is stored, shown or sent. This module
 * is imported only when a session starts with the camera on, keeping the Focus page small.
 */
import type { FrameSample } from '../core/focus/focus'
import { glide, type Point } from '../core/focus/geometry'
import type { Connections, VisionReply, VisionRequest } from './vision-protocol'

export interface CameraHandle {
  stop(): void
}

export type CameraFailure = 'denied' | 'unavailable' | 'model'

/** A live view of the face mesh, shown only while calibrating (§5.3). Never saved. */
export interface CalibrationView {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
}

/** 6 frames a second (§5.1), 3 when the device needs more than 30 ms per frame. */
const intervalMs = 1000 / 6
const slowIntervalMs = 1000 / 3
const budgetMs = 30
const base = import.meta.env.BASE_URL

function startWorker(): Promise<{ worker: Worker; connections: Connections } | null> {
  const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
  return new Promise((resolve) => {
    worker.onmessage = (event: MessageEvent<VisionReply>) => {
      if (event.data.type === 'ready') resolve({ worker, connections: event.data.connections })
      else if (event.data.type === 'failed') {
        worker.terminate()
        resolve(null)
      }
    }
    worker.onerror = () => {
      worker.terminate()
      resolve(null)
    }
    const init: VisionRequest = { type: 'init', base }
    worker.postMessage(init)
  })
}

export async function startCamera(
  onSample: (s: FrameSample) => void,
  onFailure: (reason: CameraFailure) => void,
  view?: CalibrationView,
): Promise<CameraHandle | null> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user', frameRate: { ideal: 15 } },
      audio: false,
    })
  } catch (e) {
    onFailure(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    return null
  }
  const started = await startWorker()
  if (!started) {
    for (const track of stream.getTracks()) track.stop()
    onFailure('model')
    return null
  }
  const { worker, connections } = started

  // Without a calibration view the video element is never attached to the page.
  const video = view?.video ?? document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play().catch(() => undefined)

  let stopped = false
  let busy = false
  let interval = intervalMs
  let lastSent = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
  const costs: number[] = []
  let face: Point[] | null = null

  /** One frame at a time: the next leaves only when the worker has answered. */
  const pump = async () => {
    if (stopped || busy) return
    const wait = lastSent + interval - performance.now()
    if (document.visibilityState !== 'visible' || video.readyState < 2 || wait > 0) {
      timeout = setTimeout(() => void pump(), Math.max(16, wait))
      return
    }
    busy = true
    lastSent = performance.now()
    try {
      const frame = await createImageBitmap(video, { resizeWidth: 320, resizeHeight: 240 })
      if (stopped) {
        frame.close()
        return
      }
      const message: VisionRequest = { type: 'frame', frame, time: lastSent, draw: !!view }
      worker.postMessage(message, [frame])
    } catch {
      busy = false
      timeout = setTimeout(() => void pump(), interval)
    }
  }

  worker.onmessage = (event: MessageEvent<VisionReply>) => {
    const reply = event.data
    if (reply.type !== 'result' || stopped) return
    busy = false
    costs.push(reply.cost)
    if (costs.length > 12) costs.shift()
    if (costs.length === 12 && costs.reduce((a, b) => a + b, 0) / 12 > budgetMs)
      interval = slowIntervalMs
    face = reply.face
    onSample({ ...reply.sample, timestamp: performance.now() })
    void pump()
  }
  void pump()

  const stopDrawing = view ? paint(view.canvas, connections, () => face) : null

  return {
    stop() {
      if (stopped) return
      stopped = true
      clearTimeout(timeout)
      stopDrawing?.()
      for (const track of stream.getTracks()) track.stop()
      video.srcObject = null
      const message: VisionRequest = { type: 'stop' }
      worker.postMessage(message)
    },
  }
}

/** Draws the face mesh every screen frame; points glide towards the latest analysis. */
function paint(
  canvas: HTMLCanvasElement,
  connections: Connections,
  latest: () => Point[] | null,
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  let drawn: Point[] | null = null
  let frame = 0

  const lines = (points: Point[], set: [number, number][], color: string, width: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width * dpr
    ctx.beginPath()
    for (const [a, b] of set) {
      const p = points[a]
      const q = points[b]
      if (!p || !q) continue
      ctx.moveTo(p.x * canvas.width, p.y * canvas.height)
      ctx.lineTo(q.x * canvas.width, q.y * canvas.height)
    }
    ctx.stroke()
  }

  const draw = () => {
    const box = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width * dpr))
    const h = Math.max(1, Math.round(box.height * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const target = latest()
    drawn = target ? glide(drawn, target, 0.35) : null
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (drawn) {
      ctx.lineCap = 'round'
      lines(drawn, connections.tesselation, 'rgb(255 255 255 / 0.28)', 0.5)
      lines(drawn, connections.oval, token('--color-accent-soft'), 1.5)
      lines(drawn, connections.eyes, token('--color-success-soft'), 1.5)
      lines(drawn, connections.irises, token('--color-attention-soft'), 1.5)
      lines(drawn, connections.lips, token('--color-attention-soft'), 1.5)
    }
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}
