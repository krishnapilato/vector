/**
 * Camera and microphone, reduced to a handful of booleans on this device.
 * Frames and audio are analysed in memory and dropped immediately: nothing is
 * recorded, stored or sent. The vision models are downloaded once from Google's
 * model storage and cached; the analysis runs locally (WebAssembly).
 */
import type { FaceLandmarker, ObjectDetector } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import {
  headAngles,
  isMouthMoving,
  startVoice,
  stepVoice,
  type VoiceDetector,
} from '../../core/focus/focus'

export const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
export const OBJECT_MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite'

export interface SensorReading {
  face: boolean | null
  lookingAway: boolean
  eyesClosed: boolean
  phone: boolean
  voice: boolean | null
  mouthMoving: boolean
}

export interface Sensors {
  read(): SensorReading
  stop(): void
}

export interface SensorOptions {
  camera: boolean
  mic: boolean
  phone: boolean
}

const score = (cats: { categoryName: string; score: number }[] | undefined, name: string) =>
  cats?.find((c) => c.categoryName === name)?.score ?? 0

export async function startSensors(opts: SensorOptions): Promise<Sensors> {
  const stops: (() => void)[] = []
  const reading: SensorReading = {
    face: opts.camera ? true : null,
    lookingAway: false,
    eyesClosed: false,
    phone: false,
    voice: opts.mic ? false : null,
    mouthMoving: false,
  }
  const stop = () => {
    for (const s of stops.splice(0)) s()
  }

  try {
    if (opts.camera) await startCamera(opts.phone, reading, stops)
    if (opts.mic) await startMic(reading, stops)
  } catch (e) {
    stop()
    throw e
  }
  return { read: () => ({ ...reading }), stop }
}

async function startCamera(detectPhone: boolean, reading: SensorReading, stops: (() => void)[]) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240, facingMode: 'user', frameRate: 10 },
    audio: false,
  })
  stops.push(() => {
    for (const t of stream.getTracks()) t.stop()
  })
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()

  const vision = await import('@mediapipe/tasks-vision')
  const fileset = { wasmLoaderPath, wasmBinaryPath }
  const face: FaceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })
  stops.push(() => face.close())
  let objects: ObjectDetector | null = null
  if (detectPhone) {
    objects = await vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: OBJECT_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      scoreThreshold: 0.45,
      categoryAllowlist: ['cell phone'],
      maxResults: 1,
    })
    stops.push(() => objects?.close())
  }

  const jaw: number[] = []
  let frame = 0
  const id = window.setInterval(() => {
    if (video.readyState < 2) return
    const now = performance.now()
    const r = face.detectForVideo(video, now)
    const found = r.faceLandmarks.length > 0
    reading.face = found
    if (found) {
      const cats = r.faceBlendshapes[0]?.categories
      const matrix = r.facialTransformationMatrixes?.[0]?.data
      const { yaw, pitch } = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0 }
      // Looking down at notes or a keyboard is normal: only far turns count.
      reading.lookingAway = Math.abs(yaw) > 35 || pitch > 30 || pitch < -40
      reading.eyesClosed = score(cats, 'eyeBlinkLeft') > 0.6 && score(cats, 'eyeBlinkRight') > 0.6
      jaw.push(score(cats, 'jawOpen'))
      if (jaw.length > 8) jaw.shift()
      reading.mouthMoving = isMouthMoving(jaw)
    } else {
      reading.lookingAway = false
      reading.eyesClosed = false
      reading.mouthMoving = false
      jaw.length = 0
    }
    // The phone check is heavier: once a second is enough.
    if (objects && frame++ % 8 === 0) {
      reading.phone = objects.detectForVideo(video, now + 1).detections.length > 0
    }
  }, 125)
  stops.push(() => window.clearInterval(id))
}

async function startMic(reading: SensorReading, stops: (() => void)[]) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    video: false,
  })
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  source.connect(analyser)
  stops.push(() => {
    for (const t of stream.getTracks()) t.stop()
    void ctx.close()
  })
  const buf = new Float32Array(analyser.fftSize)
  let voice: VoiceDetector = startVoice()
  const id = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const x of buf) sum += x * x
    voice = stepVoice(voice, Math.sqrt(sum / buf.length), 0.1)
    reading.voice = voice.active
  }, 100)
  stops.push(() => window.clearInterval(id))
}
