/**
 * The camera adapter (PIANO-V3 §7.1, ported from v2 src/app/focus/sensors.ts, camera only).
 * Frames are analysed in memory by MediaPipe and dropped at once: nothing is stored or sent.
 * Only a few numbers per frame reach src/core/focus.
 *
 * Models (ADR 0008), all served by the app itself so no request leaves the origin:
 * - Face Landmarker every frame (6 fps, 3 on slow devices): face, head angles, eyes, mouth.
 * - Pose Landmarker lite at ~2 fps: shoulder height (standing up, slumping).
 * - Object Detector at ~1 fps: a phone in the picture.
 * - Hand Landmarker at ~1 fps: a hand resting on the face.
 */
import type {
  Detection,
  FaceLandmarker,
  FaceLandmarkerResult,
  HandLandmarker,
  NormalizedLandmark,
  ObjectDetector,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'
import type { FrameSample } from '../core/focus/focus'

export interface CameraHandle {
  stop(): void
  /** Frames per second actually used: 6, or 3 when the device is slow (§7.7). */
  readonly fps: number
}

export type CameraFailure = 'denied' | 'unavailable' | 'model'

/**
 * Optional live view (docs/proposte.md, n. 2 and 3): the image and what the models see are
 * drawn while the Settings check is open, or as a soft preview if turned on. Never saved.
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

const budgetMs = 30
const base = import.meta.env.BASE_URL
const model = (file: string) => `${base}models/${file}`

const modelFiles = [
  'face_landmarker.task',
  'efficientdet_lite0.tflite',
  'pose_landmarker_lite.task',
  'hand_landmarker.task',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
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
      fetch(model(f))
        .then((r) => r.arrayBuffer())
        .catch(() => undefined),
    ),
  )
}

interface Models {
  face: FaceLandmarker
  pose: PoseLandmarker | null
  objects: ObjectDetector | null
  hands: HandLandmarker | null
}

/** GPU first, CPU if the device has no usable GPU. */
async function withDelegate<T>(make: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await make('GPU')
  } catch {
    return make('CPU')
  }
}

/** An extra model that fails to load simply stays off. */
async function optional<T>(make: () => Promise<T>): Promise<T | null> {
  try {
    return await make()
  } catch {
    return null
  }
}

async function createModels(extras: boolean): Promise<Models> {
  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(model('wasm'))
  const face = await withDelegate((delegate) =>
    vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: model('face_landmarker.task'), delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    }),
  )
  if (!extras) return { face, pose: null, objects: null, hands: null }
  const [pose, objects, hands] = await Promise.all([
    optional(() =>
      withDelegate((delegate) =>
        vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: model('pose_landmarker_lite.task'), delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        }),
      ),
    ),
    optional(() =>
      withDelegate((delegate) =>
        vision.ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: model('efficientdet_lite0.tflite'), delegate },
          runningMode: 'VIDEO',
          maxResults: 1,
          scoreThreshold: 0.45,
          categoryAllowlist: ['cell phone'],
        }),
      ),
    ),
    optional(() =>
      withDelegate((delegate) =>
        vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: model('hand_landmarker.task'), delegate },
          runningMode: 'VIDEO',
          numHands: 2,
        }),
      ),
    ),
  ])
  return { face, pose, objects, hands }
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

/** Bounding box of the face, normalised, grown a little to include the chin and cheeks. */
function faceBox(points: readonly NormalizedLandmark[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const padX = (x1 - x0) * 0.2
  const padY = (y1 - y0) * 0.35
  return { x0: x0 - padX, x1: x1 + padX, y0: y0 - padY, y1: y1 + padY }
}

interface Extras {
  phone: boolean | null
  shoulderY: number | null
  handOnFace: boolean | null
  phoneBox: Detection | null
  pose: NormalizedLandmark[] | null
  hands: NormalizedLandmark[][]
}

function toSample(result: FaceLandmarkerResult, extras: Extras, t: number): FrameSample {
  const matrix = result.facialTransformationMatrixes[0]?.data
  const shapes = result.faceBlendshapes[0]?.categories ?? []
  const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0
  const angles = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0 }
  return {
    t,
    facePresent: result.faceLandmarks.length > 0,
    yaw: angles.yaw,
    pitch: angles.pitch,
    blink: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
    jawOpen: score('jawOpen'),
    phone: extras.phone,
    shoulderY: extras.shoulderY,
    handOnFace: extras.handOnFace,
  }
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
      video: { width: 320, height: 240, facingMode: 'user', frameRate: { ideal: 15, max: 30 } },
      audio: false,
    })
  } catch (e) {
    onFailure(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    return null
  }

  let models: Models
  try {
    models = await createModels(options.extras)
  } catch {
    for (const track of stream.getTracks()) track.stop()
    onFailure('model')
    return null
  }

  // Without a preview the video element is never attached to the page: no image is shown.
  const preview = options.preview
  const video = preview?.video ?? document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play().catch(() => undefined)

  const draw = preview ? await painter(preview.canvas) : null
  const extras: Extras = {
    phone: models.objects ? false : null,
    shoulderY: null,
    handOnFace: models.hands ? false : null,
    phoneBox: null,
    pose: null,
    hands: [],
  }
  let fps = 6
  let frame = 0
  let stopped = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  const t0 = performance.now()
  const costs: number[] = []

  const tick = () => {
    if (stopped) return
    if (document.visibilityState === 'visible' && video.readyState >= 2) {
      const start = performance.now()
      const result = models.face.detectForVideo(video, start)
      // The other models take turns, so a frame never runs more than two of them.
      const slot = frame % 6
      if (models.pose && (slot === 1 || slot === 4)) {
        const pose = models.pose.detectForVideo(video, start).landmarks[0] ?? null
        extras.pose = pose
        const l = pose?.[11]
        const r = pose?.[12]
        extras.shoulderY =
          l && r && (l.visibility ?? 1) > 0.5 && (r.visibility ?? 1) > 0.5 ? (l.y + r.y) / 2 : null
      }
      if (models.objects && slot === 2) {
        const found = models.objects.detectForVideo(video, start).detections[0] ?? null
        extras.phoneBox = found
        extras.phone = found !== null
      }
      if (models.hands && slot === 5) {
        const hands = models.hands.detectForVideo(video, start).landmarks
        extras.hands = hands
        const points = result.faceLandmarks[0]
        const box = points ? faceBox(points) : null
        extras.handOnFace = box
          ? hands.some((h) =>
              [0, 5, 9, 13].some((i) => {
                const p = h[i]
                return !!p && p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1
              }),
            )
          : false
      }
      const cost = performance.now() - start
      costs.push(cost)
      if (costs.length > 12) costs.shift()
      if (fps === 6 && costs.length === 12 && costs.reduce((a, b) => a + b, 0) / 12 > budgetMs)
        fps = 3
      draw?.(result, extras)
      onSample(toSample(result, extras, (start - t0) / 1000))
      frame++
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
      models.face.close()
      models.pose?.close()
      models.objects?.close()
      models.hands?.close()
      preview?.canvas.getContext('2d')?.clearRect(0, 0, preview.canvas.width, preview.canvas.height)
    },
  }
}

/** Draws what the models see, in the app's colours. */
async function painter(
  canvas: HTMLCanvasElement,
): Promise<(face: FaceLandmarkerResult, extras: Extras) => void> {
  const { DrawingUtils, FaceLandmarker, HandLandmarker, PoseLandmarker } = await import(
    '@mediapipe/tasks-vision'
  )
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim() || '#ffffff'
  const paint = new DrawingUtils(ctx)
  const faceParts = [
    { set: FaceLandmarker.FACE_LANDMARKS_TESSELATION, color: 'rgb(255 255 255 / 0.3)', width: 0.5 },
    {
      set: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
      color: token('--color-accent-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      color: token('--color-success-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      color: token('--color-success-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      color: token('--color-attention-soft'),
      width: 1.5,
    },
    {
      set: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
      color: token('--color-attention-soft'),
      width: 1.5,
    },
    { set: FaceLandmarker.FACE_LANDMARKS_LIPS, color: token('--color-attention-soft'), width: 1.5 },
  ]
  return (face, extras) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (extras.pose)
      paint.drawConnectors(extras.pose, PoseLandmarker.POSE_CONNECTIONS, {
        color: token('--color-rule'),
        lineWidth: 2,
      })
    for (const points of face.faceLandmarks)
      for (const part of faceParts)
        paint.drawConnectors(points, part.set, { color: part.color, lineWidth: part.width })
    for (const hand of extras.hands)
      paint.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
        color: token('--color-success-soft'),
        lineWidth: 2,
      })
    const box = extras.phoneBox?.boundingBox
    if (box) {
      ctx.strokeStyle = token('--color-attention-soft')
      ctx.lineWidth = 2
      ctx.strokeRect(box.originX, box.originY, box.width, box.height)
    }
  }
}
