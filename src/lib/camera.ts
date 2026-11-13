/**
 * The camera adapter (PIANO-V3 §7.1, ported from v2 src/app/focus/sensors.ts, camera only).
 * The page only grabs frames; the models run in a Web Worker (ADR 0009) so nothing stutters.
 * Frames are analysed in memory and dropped at once: nothing is stored or sent. Only a few
 * numbers per frame reach src/core/focus. Models are served by the app itself (ADR 0008).
 */
import type { FrameSample } from '../core/focus/focus'
import { glide, type Point } from '../core/focus/geometry'
import type { Connections, DrawData, VisionReply, VisionRequest } from './vision-protocol'

export interface CameraHandle {
  stop(): void
  /** Analyses per second actually reached. */
  readonly fps: number
}

export type CameraFailure = 'denied' | 'unavailable' | 'model'

/**
 * Optional live view (docs/proposte.md, n. 2 and 3): the image and what the models see are
 * drawn while the Settings check is open, or as a soft view if turned on. Never saved.
 */
export interface Preview {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
}

export interface CameraOptions {
  /** Phone, posture and hands (ADR 0008). Face only when false. */
  extras: boolean
  preview?: Preview
}

/** Sessions need 6 analyses a second (3 on slow devices, §7.7); a live view looks smooth at 30. */
const sessionInterval = 1000 / 6
const slowInterval = 1000 / 3
const previewInterval = 1000 / 30
const budgetMs = 30
const base = import.meta.env.BASE_URL

const modelFiles = [
  'face_landmarker.task',
  'efficientdet_lite0.tflite',
  'pose_landmarker_lite.task',
  'hand_landmarker.task',
  'wasm/vision_wasm_module_internal.js',
  'wasm/vision_wasm_module_internal.wasm',
]

/** Asks the browser for camera permission now, without analysing anything. */
export async function askPermission(): Promise<'granted' | CameraFailure> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    for (const track of stream.getTracks()) track.stop()
    return 'granted'
  } catch (e) {
    return e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable'
  }
}

/** Fetches the model files once so the service worker keeps them for offline use. */
export async function warmModels(): Promise<void> {
  await Promise.all(
    modelFiles.map((f) =>
      fetch(`${base}models/${f}`)
        .then((r) => r.arrayBuffer())
        .catch(() => undefined),
    ),
  )
}

function startWorker(
  extras: boolean,
): Promise<{ worker: Worker; connections: Connections } | null> {
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
    const init: VisionRequest = { type: 'init', base, extras }
    worker.postMessage(init)
  })
}

/** Starts the camera at 320×240 and analyses frames while the page is visible. */
export async function startCamera(
  onSample: (s: FrameSample) => void,
  onFailure: (reason: CameraFailure) => void,
  options: CameraOptions,
): Promise<CameraHandle | null> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // A live view looks sharp at 640×480; the analysis always runs on a 320×240 copy.
      video: options.preview
        ? { width: 640, height: 480, facingMode: 'user', frameRate: { ideal: 30 } }
        : { width: 320, height: 240, facingMode: 'user', frameRate: { ideal: 15 } },
      audio: false,
    })
  } catch (e) {
    onFailure(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    return null
  }

  const started = await startWorker(options.extras)
  if (!started) {
    for (const track of stream.getTracks()) track.stop()
    onFailure('model')
    return null
  }
  const { worker, connections } = started

  // Without a live view the video element is never attached to the page: no image is shown.
  const preview = options.preview
  const video = preview?.video ?? document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play().catch(() => undefined)

  let stopped = false
  let busy = false
  let interval = preview ? previewInterval : sessionInterval
  let lastSent = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
  const t0 = performance.now()
  const costs: number[] = []
  const done: number[] = []
  let target: DrawData | null = null

  /** One frame at a time: a new one leaves only when the worker has answered. */
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
      const message: VisionRequest = { type: 'frame', frame, time: lastSent, draw: !!preview }
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
    if (!preview && costs.length === 12 && costs.reduce((a, b) => a + b, 0) / 12 > budgetMs)
      interval = slowInterval
    const now = performance.now()
    done.push(now)
    while (done.length > 0 && (done[0] ?? now) < now - 1000) done.shift()
    if (reply.draw) target = reply.draw
    onSample({ ...reply.sample, t: (now - t0) / 1000 })
    void pump()
  }
  void pump()

  const stopDrawing = preview ? paint(preview.canvas, connections, () => target) : null

  return {
    get fps() {
      return done.length
    },
    stop() {
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

/**
 * Draws what the models see on every screen frame. Points glide towards the latest analysis
 * instead of jumping, so the mesh moves softly even between analyses.
 */
function paint(
  canvas: HTMLCanvasElement,
  connections: Connections,
  latest: () => DrawData | null,
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  const css = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const colors = {
    mesh: 'rgb(255 255 255 / 0.28)',
    oval: token('--color-accent-soft', '#e2eafb'),
    eyes: token('--color-success-soft', '#ddf3e6'),
    warm: token('--color-attention-soft', '#fbefd6'),
    pose: token('--color-rule', '#bfcfe5'),
  }
  const share = 0.35
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  /** Draw at the size the canvas is shown, so lines stay sharp. */
  const fitCanvas = () => {
    const box = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width * dpr))
    const h = Math.max(1, Math.round(box.height * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }
  let face: Point[] | null = null
  let pose: Point[] | null = null
  let hands: Point[][] = []
  let frame = 0

  const lines = (points: Point[] | null, set: [number, number][], color: string, width: number) => {
    if (!points) return
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
    fitCanvas()
    const data = latest()
    face = data?.face ? glide(face, data.face, share) : null
    pose = data?.pose ? glide(pose, data.pose, share) : null
    hands = (data?.hands ?? []).map((h, i) => glide(hands[i] ?? null, h, share))
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    lines(pose, connections.pose, colors.pose, 2)
    lines(face, connections.tesselation, colors.mesh, 0.5)
    lines(face, connections.oval, colors.oval, 1.5)
    lines(face, connections.eyes, colors.eyes, 1.5)
    lines(face, connections.irises, colors.warm, 1.5)
    lines(face, connections.lips, colors.warm, 1.5)
    for (const hand of hands) lines(hand, connections.hand, colors.eyes, 2)
    const phone = data?.phone
    if (phone) {
      ctx.strokeStyle = colors.warm
      ctx.lineWidth = 2 * dpr
      ctx.strokeRect(
        phone.x * canvas.width,
        phone.y * canvas.height,
        phone.w * canvas.width,
        phone.h * canvas.height,
      )
    }
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}
