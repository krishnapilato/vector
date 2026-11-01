/**
 * The sync server: a tiny blob store for ciphertext, run as a Cloudflare Worker
 * (see /worker). Kept here, framework-free, so it is tested with the rest of the core.
 * It cannot read anything: it stores opaque bytes under an opaque id.
 */

export interface BlobMeta {
  tokenHash: string
  version: number
  updatedAt: string
}

/** The subset of Cloudflare KV the server needs. */
export interface BlobStore {
  get(key: string): Promise<{ value: string; meta: BlobMeta } | null>
  put(key: string, value: string, meta: BlobMeta): Promise<void>
  delete(key: string): Promise<void>
}

export interface ServerEnv {
  store: BlobStore
  /** Exact origin allowed to call, e.g. https://you.github.io; '*' only for testing. */
  allowedOrigin: string
  maxBytes?: number
}

const ID = /^[0-9a-f]{64}$/

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison of two hex strings of equal length. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

export async function handle(req: Request, env: ServerEnv): Promise<Response> {
  const cors: Record<string, string> = {
    'access-control-allow-origin': env.allowedOrigin,
    'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-base-version',
    'access-control-expose-headers': 'x-version',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
  const reply = (status: number, body: unknown = null, extra: Record<string, string> = {}) =>
    new Response(body === null ? null : typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        ...extra,
        ...(body !== null && typeof body !== 'string'
          ? { 'content-type': 'application/json' }
          : {}),
        'cache-control': 'no-store',
      },
    })

  const origin = req.headers.get('origin')
  if (env.allowedOrigin !== '*' && origin !== null && origin !== env.allowedOrigin)
    return reply(403, { error: 'origin' })
  if (req.method === 'OPTIONS') return reply(204)

  const url = new URL(req.url)
  const match = /^\/v1\/([^/]+)$/.exec(url.pathname)
  if (!match) return reply(404, { error: 'not found' })
  const id = match[1] as string
  if (!ID.test(id)) return reply(400, { error: 'id' })

  const token = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('authorization') ?? '')?.[1]
  if (!token) return reply(401, { error: 'token' })
  const tokenHash = await sha256(token)
  const current = await env.store.get(id)
  if (current && !same(current.meta.tokenHash, tokenHash)) return reply(403, { error: 'token' })

  if (req.method === 'GET') {
    if (!current) return reply(404, { error: 'empty' })
    return reply(200, current.value, {
      'content-type': 'application/json',
      'x-version': String(current.meta.version),
    })
  }

  if (req.method === 'PUT') {
    const base = Number(req.headers.get('x-base-version') ?? 'NaN')
    const version = current?.meta.version ?? 0
    if (!Number.isInteger(base)) return reply(400, { error: 'base version' })
    if (base !== version) return reply(409, { error: 'conflict', version })
    const body = await req.text()
    if (body.length > (env.maxBytes ?? 20_000_000)) return reply(413, { error: 'too large' })
    let parsed: { format?: unknown } | null = null
    try {
      parsed = JSON.parse(body) as { format?: unknown }
    } catch {
      parsed = null
    }
    // Refuse anything that is not an encrypted envelope: plaintext must never be stored.
    if (parsed?.format !== 'encrypted') return reply(400, { error: 'not encrypted' })
    const meta: BlobMeta = { tokenHash, version: version + 1, updatedAt: new Date().toISOString() }
    await env.store.put(id, body, meta)
    return reply(200, { version: meta.version })
  }

  if (req.method === 'DELETE') {
    if (current) await env.store.delete(id)
    return reply(204)
  }

  return reply(405, { error: 'method' })
}
