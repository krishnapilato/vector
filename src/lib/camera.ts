/**
 * The camera adapter (PIANO-V3 §7.1, ported from v2 src/app/focus/sensors.ts, camera only).
 * Frames are analysed in memory by MediaPipe Face Landmarker and dropped at once: nothing is
 * drawn, stored or sent. Only a few numbers per frame reach src/core/focus.
 * Model and WASM are served by the app itself (public/models), so no request leaves the origin.
 */
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import type { FrameSample } from '../core/focus/focus'

export interface CameraHandle {
  stop(): void
  /** Frames per second actually used: 6, or 3 when the device is slow (§7.7). */
  readonly fps: number
}

export type CameraFailure = 'denied' | 'unavailable' | 'model'

const budgetMs = 30
const base = import.meta.env.BASE_URL

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
  const files = [
    'models/face_landmarker.task',
    'models/wasm/vision_wasm_internal.js',
    'models/wasm/vision_wasm_internal.wasm',
  ]
  await Promise.all(
    files.map((f) =>
      fetch(`${base}${f}`)
        .then((r) => r.arrayBuffer())
        .catch(() => undefined),
    ),
  )
}

async function createLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(`${base}models/wasm`)
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })
  try {
    return await FaceLandmarker.createFromOptions(fileset, options('GPU'))
  } catch {
    return FaceLandmarker.createFromOptions(fileset, options('CPU'))
  }
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

function toSample(result: FaceLandmarkerResult, t: number): FrameSample {
  const face = result.faceLandmarks.length > 0
  const matrix = result.facialTransformationMatrixes[0]?.data
  const shapes = result.faceBlendshapes[0]?.categories ?? []
  const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0
  const angles = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0 }
  return {
    t,
    facePresent: face,
    yaw: angles.yaw,
    pitch: angles.pitch,
    blink: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
    jawOpen: score('jawOpen'),
  }
}

/**
 * Optional live check for Settings only (docs/proposte.md, n. 2): the image and the face mesh are
 * drawn while the panel is open, never during a session, and never saved.
 */
export interface Preview {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
}

/** Starts the camera at 320×240 and analyses frames while the page is visible. */
export async function startCamera(
  onSample: (s: FrameSample) => void,
  onFailure: (reason: CameraFailure) => void,
  preview?: Preview,
): Promise<CameraHandle | null> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user', frameRate: { ideal: 15, max: 30 } },
      audio: false,
    })
  } catch (e) {
    onFailure(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    return null
  }

  let landmarker: FaceLandmarker
  try {
    landmarker = await createLandmarker()
  } catch {
    for (const track of stream.getTracks()) track.stop()
    onFailure('model')
    return null
  }

  // In sessions the video element is never attached to the page: no image is ever shown.
  const video = preview?.video ?? document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play().catch(() => undefined)

  const draw = preview ? await meshPainter(preview.canvas) : null
  let fps = 6
  let stopped = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  const t0 = performance.now()
  const costs: number[] = []

  const tick = () => {
    if (stopped) return
    if (document.visibilityState === 'visible' && video.readyState >= 2) {
      const start = performance.now()
      const result = landmarker.detectForVideo(video, start)
      const cost = performance.now() - start
      costs.push(cost)
      if (costs.length > 12) costs.shift()
      if (fps === 6 && costs.length === 12 && costs.reduce((a, b) => a + b, 0) / 12 > budgetMs)
        fps = 3
      draw?.(result)
      onSample(toSample(result, (start - t0) / 1000))
    }
    timeout = setTimeout(tick, 1000 / fps)
  }
  tick()

  return {
    get fps() {
      return fps
    },
    stop() {
      stopped = true
      clearTimeout(timeout)
      for (const track of stream.getTracks()) track.stop()
      video.srcObject = null
      landmarker.close()
      preview?.canvas.getContext('2d')?.clearRect(0, 0, preview.canvas.width, preview.canvas.height)
    },
  }
}

/** Draws the face mesh MediaPipe sees, in the app's colours. */
async function meshPainter(canvas: HTMLCanvasElement): Promise<(r: FaceLandmarkerResult) => void> {
  const { DrawingUtils, FaceLandmarker } = await import('@mediapipe/tasks-vision')
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  const css = getComputedStyle(document.documentElement)
  const color = (token: string) => css.getPropertyValue(token).trim() || '#294490'
  const paint = new DrawingUtils(ctx)
  const parts = [
    {
      set: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
      color: 'rgb(255 255 255 / 0.35)',
      width: 0.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
      color: color('--color-accent-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      color: color('--color-success-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      color: color('--color-success-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      color: color('--color-attention-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
      color: color('--color-attention-soft'),
      width: 1.5,
    },
    { set: FaceLandmarker.FACE_LANDMARKS_LIPS, color: color('--color-attention-soft'), width: 1.5 },
  ]
  return (result) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const face of result.faceLandmarks)
      for (const p of parts)
        paint.drawConnectors(face, p.set, { color: p.color, lineWidth: p.width })
  }
}
