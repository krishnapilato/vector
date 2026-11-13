/// <reference lib="webworker" />
/**
 * MediaPipe models off the main thread (ADR 0009), so the page and the video never stutter.
 * Receives one frame at a time as an ImageBitmap, answers with a few numbers (and, only when the
 * learner opened a live view, the points to draw). Frames are closed as soon as they are analysed.
 * A module worker, with MediaPipe's ES-module WASM build (forVisionTasks(…, true)).
 */
import {
  FaceLandmarker,
  HandLandmarker,
  ObjectDetector,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'
import { faceBox, handOnFace, headAngles, type Point, shoulderHeight } from '../core/focus/geometry'
import type { VisionReply, VisionRequest } from './vision-protocol'

declare const self: DedicatedWorkerGlobalScope

/** How often each extra model runs, in ms: the face runs on every frame. */
const every = { pose: 150, objects: 600, hands: 300 }

let face: FaceLandmarker | null = null
let pose: PoseLandmarker | null = null
let objects: ObjectDetector | null = null
let hands: HandLandmarker | null = null
const last = { pose: -Infinity, objects: -Infinity, hands: -Infinity }
const latest: {
  shoulderY: number | null
  phone: boolean | null
  phoneBox: { x: number; y: number; w: number; h: number } | null
  pose: Point[] | null
  hands: Point[][]
  handOnFace: boolean | null
} = { shoulderY: null, phone: null, phoneBox: null, pose: null, hands: [], handOnFace: null }

const reply = (message: VisionReply) => self.postMessage(message)

/**
 * MediaPipe clears self.ModuleFactory after building each model, and in a module worker its
 * import() of the WASM glue is cached, so the factory is never set again. We import the glue once
 * and hand the factory back before every model.
 */
let factory: unknown = null
const prime = () => {
  ;(self as unknown as { ModuleFactory?: unknown }).ModuleFactory = factory
}

async function withDelegate<T>(make: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    prime()
    return await make('GPU')
  } catch {
    prime()
    return make('CPU')
  }
}

async function optional<T>(make: () => Promise<T>): Promise<T | null> {
  try {
    return await make()
  } catch {
    return null
  }
}

const pairs = (set: readonly { start: number; end: number }[]) =>
  set.map((c) => [c.start, c.end] as [number, number])

async function init(base: string, extras: boolean) {
  const model = (file: string) => new URL(`${base}models/${file}`, self.location.href).href
  try {
    // The WASM glue is fetched and imported from a Blob URL: dev servers refuse to import files
    // from public/, and this way the same path works everywhere.
    const glue = await (await fetch(model('wasm/vision_wasm_module_internal.js'))).text()
    const loader = URL.createObjectURL(new Blob([glue], { type: 'text/javascript' }))
    factory = ((await import(/* @vite-ignore */ loader)) as { default: unknown }).default
    const fileset: Parameters<typeof FaceLandmarker.createFromOptions>[0] = {
      wasmLoaderPath: loader,
      wasmBinaryPath: model('wasm/vision_wasm_module_internal.wasm'),
    }
    face = await withDelegate((delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model('face_landmarker.task'), delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }),
    )
    if (extras) {
      // One at a time: each needs the factory handed back (see prime).
      pose = await optional(() =>
        withDelegate((delegate) =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model('pose_landmarker_lite.task'), delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          }),
        ),
      )
      objects = await optional(() =>
        withDelegate((delegate) =>
          ObjectDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model('efficientdet_lite0.tflite'), delegate },
            runningMode: 'VIDEO',
            maxResults: 1,
            scoreThreshold: 0.45,
            categoryAllowlist: ['cell phone'],
          }),
        ),
      )
      hands = await optional(() =>
        withDelegate((delegate) =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model('hand_landmarker.task'), delegate },
            runningMode: 'VIDEO',
            numHands: 2,
          }),
        ),
      )
    }
    latest.phone = objects ? false : null
    latest.handOnFace = hands ? false : null
    reply({
      type: 'ready',
      loaded: { pose: !!pose, objects: !!objects, hands: !!hands },
      connections: {
        tesselation: pairs(FaceLandmarker.FACE_LANDMARKS_TESSELATION),
        oval: pairs(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL),
        eyes: pairs([
          ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        ]),
        irises: pairs([
          ...FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
          ...FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        ]),
        lips: pairs(FaceLandmarker.FACE_LANDMARKS_LIPS),
        pose: pairs(PoseLandmarker.POSE_CONNECTIONS),
        hand: pairs(HandLandmarker.HAND_CONNECTIONS),
      },
    })
  } catch {
    reply({ type: 'failed' })
  }
}

const xy = (points: readonly Point[]) => points.map((p) => ({ x: p.x, y: p.y }))

function analyse(frame: ImageBitmap, time: number, draw: boolean) {
  if (!face) {
    frame.close()
    return
  }
  const start = performance.now()
  const result = face.detectForVideo(frame, time)
  const points = result.faceLandmarks[0] ?? null
  if (pose && time - last.pose >= every.pose) {
    last.pose = time
    latest.pose = pose.detectForVideo(frame, time).landmarks[0] ?? null
    latest.shoulderY = shoulderHeight(latest.pose)
  }
  if (objects && time - last.objects >= every.objects) {
    last.objects = time
    const box = objects.detectForVideo(frame, time).detections[0]?.boundingBox
    latest.phone = !!box
    latest.phoneBox = box
      ? {
          x: box.originX / frame.width,
          y: box.originY / frame.height,
          w: box.width / frame.width,
          h: box.height / frame.height,
        }
      : null
  }
  if (hands && time - last.hands >= every.hands) {
    last.hands = time
    latest.hands = hands.detectForVideo(frame, time).landmarks
    latest.handOnFace = handOnFace(latest.hands, points ? faceBox(points) : null)
  }
  frame.close()

  const shapes = result.faceBlendshapes[0]?.categories ?? []
  const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0
  const matrix = result.facialTransformationMatrixes[0]?.data
  const angles = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0 }
  reply({
    type: 'result',
    cost: performance.now() - start,
    sample: {
      facePresent: points !== null,
      yaw: angles.yaw,
      pitch: angles.pitch,
      blink: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
      jawOpen: score('jawOpen'),
      phone: latest.phone,
      shoulderY: latest.shoulderY,
      handOnFace: latest.handOnFace,
    },
    draw: draw
      ? {
          face: points ? xy(points) : null,
          pose: latest.pose ? xy(latest.pose) : null,
          hands: latest.hands.map(xy),
          phone: latest.phoneBox,
        }
      : null,
  })
}

self.onmessage = (event: MessageEvent<VisionRequest>) => {
  const message = event.data
  if (message.type === 'init') void init(message.base, message.extras)
  else if (message.type === 'frame') analyse(message.frame, message.time, message.draw)
  else {
    face?.close()
    pose?.close()
    objects?.close()
    hands?.close()
    self.close()
  }
}
