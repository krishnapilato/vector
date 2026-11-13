// Puts the MediaPipe Face Landmarker model and WASM into public/models/ so the app serves them
// itself (PIANO-V3 §7.1): no request to Google while studying, and it works offline.
// The model (Apache-2.0) is downloaded once from MediaPipe's official bucket and checked
// against a pinned SHA-256; the WASM comes from the pinned @mediapipe/tasks-vision package.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const modelSha256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
const cache = '.cache/face_landmarker.task'
const out = 'public/models'
const wasmDir = 'node_modules/@mediapipe/tasks-vision/wasm'
const wasmFiles = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

mkdirSync('.cache', { recursive: true })
mkdirSync(join(out, 'wasm'), { recursive: true })

if (!existsSync(cache) || sha256(readFileSync(cache)) !== modelSha256) {
  console.log('Downloading face_landmarker.task …')
  const res = await fetch(modelUrl)
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (sha256(buf) !== modelSha256) throw new Error('Model checksum mismatch: refusing to use it.')
  writeFileSync(cache, buf)
}
copyFileSync(cache, join(out, 'face_landmarker.task'))
for (const f of wasmFiles) copyFileSync(join(wasmDir, f), join(out, 'wasm', f))
console.log('Models ready in public/models/')
