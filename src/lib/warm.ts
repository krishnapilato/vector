/**
 * Fetches the face model and WASM once, while the learner is idle, so the service worker keeps
 * them and the camera works offline from then on (PIANO-V3-LITE §2.1, §5.1).
 */
const files = [
  'face_landmarker.task',
  'wasm/vision_wasm_module_internal.js',
  'wasm/vision_wasm_module_internal.wasm',
]

export async function warmModels(): Promise<void> {
  const base = import.meta.env.BASE_URL
  await Promise.all(
    files.map((f) =>
      fetch(`${base}models/${f}`)
        .then((r) => r.arrayBuffer())
        .catch(() => undefined),
    ),
  )
}
