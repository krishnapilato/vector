// Puts the MediaPipe Face Landmarker model and WASM into public/models/ so the app serves them itself
// (PIANO-V3-LITE §5.1): no request to Google while studying, and it works offline.
// Models (Apache-2.0) are downloaded once from MediaPipe's official bucket and checked against
// pinned SHA-256 hashes; the WASM comes from the pinned @mediapipe/tasks-vision package.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const bucket = 'https://storage.googleapis.com/mediapipe-models'
const models = [
  {
    file: 'face_landmarker.task',
    path: 'face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
  },
]
const out = 'public/models'
const wasmDir = 'node_modules/@mediapipe/tasks-vision/wasm'
// The ES-module build, loaded by the vision worker (ADR 0009).
const wasmFiles = ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

mkdirSync('.cache', { recursive: true })
// Start clean so no stale model or WASM ends up in the build.
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'wasm'), { recursive: true })

for (const model of models) {
  const cache = join('.cache', model.file)
  if (!existsSync(cache) || sha256(readFileSync(cache)) !== model.sha256) {
    console.log(`Downloading ${model.file} …`)
    const res = await fetch(`${bucket}/${model.path}`)
    if (!res.ok) throw new Error(`Model download failed: ${model.file} ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (sha256(buf) !== model.sha256) throw new Error(`Checksum mismatch for ${model.file}.`)
    writeFileSync(cache, buf)
  }
  copyFileSync(cache, join(out, model.file))
}
for (const f of wasmFiles) copyFileSync(join(wasmDir, f), join(out, 'wasm', f))
console.log('Models ready in public/models/')
