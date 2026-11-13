/// <reference lib="webworker" />
/**
 * MediaPipe Face Landmarker off the main thread (ADR 0009), so the page never stutters.
 * Receives one frame at a time as an ImageBitmap and answers with a few numbers (plus the face
 * points while a calibration view is open). Each frame is closed as soon as it is analysed.
 */
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import { headAngles } from '../core/focus/geometry'
import type { VisionReply, VisionRequest } from './vision-protocol'
import { localFetch } from './worker-network'

declare const self: DedicatedWorkerGlobalScope

// MediaPipe includes usage telemetry. Block cross-origin fetches before model initialization.
// GitHub Pages cannot set CSP response headers on the worker script itself.
self.fetch = localFetch(self.fetch.bind(self), self.location.href)

let face: FaceLandmarker | null = null

const reply = (message: VisionReply) => self.postMessage(message)
const pairs = (set: readonly { start: number; end: number }[]) =>
  set.map((c) => [c.start, c.end] as [number, number])

async function init(base: string) {
  const model = (file: string) => new URL(`${base}models/${file}`, self.location.href).href
  try {
    // The ES-module WASM glue is fetched and imported from a Blob URL: dev servers refuse to
    // import files from public/, and this way one path works everywhere. MediaPipe clears
    // self.ModuleFactory after building a model, so it is handed over just before.
    const glue = await (await fetch(model('wasm/vision_wasm_module_internal.js'))).text()
    const loader = URL.createObjectURL(new Blob([glue], { type: 'text/javascript' }))
    const factory = ((await import(/* @vite-ignore */ loader)) as { default: unknown }).default
    const fileset: Parameters<typeof FaceLandmarker.createFromOptions>[0] = {
      wasmLoaderPath: loader,
      wasmBinaryPath: model('wasm/vision_wasm_module_internal.wasm'),
    }
    const create = (delegate: 'GPU' | 'CPU') => {
      ;(self as unknown as { ModuleFactory?: unknown }).ModuleFactory = factory
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model('face_landmarker.task'), delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      })
    }
    face = await create('GPU').catch(() => create('CPU'))
    reply({
      type: 'ready',
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
      },
    })
  } catch {
    reply({ type: 'failed' })
  }
}

function analyse(frame: ImageBitmap, time: number, draw: boolean) {
  if (!face) {
    frame.close()
    return
  }
  const start = performance.now()
  const result = face.detectForVideo(frame, time)
  frame.close()
  const points = result.faceLandmarks[0] ?? null
  const shapes = result.faceBlendshapes[0]?.categories ?? []
  const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0
  const matrix = result.facialTransformationMatrixes[0]?.data
  const angles = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0, roll: 0 }
  reply({
    type: 'result',
    cost: performance.now() - start,
    sample: {
      facePresent: points !== null,
      yaw: angles.yaw,
      pitch: angles.pitch,
      roll: angles.roll,
      eyeClosedScore: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
      jawOpenScore: score('jawOpen'),
    },
    face: draw && points ? points.map((p) => ({ x: p.x, y: p.y })) : null,
  })
}

self.onmessage = (event: MessageEvent<VisionRequest>) => {
  const message = event.data
  if (message.type === 'init') void init(message.base)
  else if (message.type === 'frame') analyse(message.frame, message.time, message.draw)
  else {
    face?.close()
    self.close()
  }
}
