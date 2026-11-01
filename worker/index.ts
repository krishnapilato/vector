/**
 * Vector sync server for Cloudflare Workers. Deploy it to your own account:
 * see worker/README.md. It stores only encrypted blobs.
 */
import { type BlobMeta, handle } from '../src/core/sync/server'

interface KVNamespace {
  getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>
  put(key: string, value: string, options: { metadata: unknown }): Promise<void>
  delete(key: string): Promise<void>
}

interface Env {
  VECTOR_SYNC: KVNamespace
  ALLOWED_ORIGIN: string
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, {
      allowedOrigin: env.ALLOWED_ORIGIN,
      store: {
        async get(key) {
          const r = await env.VECTOR_SYNC.getWithMetadata<BlobMeta>(key)
          return r.value !== null && r.metadata ? { value: r.value, meta: r.metadata } : null
        },
        put: (key, value, meta) => env.VECTOR_SYNC.put(key, value, { metadata: meta }),
        delete: (key) => env.VECTOR_SYNC.delete(key),
      },
    })
  },
}
