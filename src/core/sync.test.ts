import { describe, expect, it } from 'vitest'
import {
  decrypt,
  encrypt,
  fromBase64,
  generatePassphrase,
  isEnvelope,
  passphraseProblem,
  sha256Hex,
  syncIdentity,
  toBase64,
  WrongPassphrase,
  words,
} from './sync/crypto'
import { type BlobMeta, type BlobStore, handle } from './sync/server'

const FAST = 1000

describe('crypto', () => {
  it('round-trips and fails cleanly with the wrong passphrase', async () => {
    const e = await encrypt('{"ciao":"àè ✓"}', 'frase segreta lunga', FAST)
    expect(isEnvelope(e)).toBe(true)
    expect(e.data).not.toContain('ciao')
    expect(await decrypt(e, 'frase segreta lunga')).toBe('{"ciao":"àè ✓"}')
    await expect(decrypt(e, 'altra frase')).rejects.toBeInstanceOf(WrongPassphrase)
  })

  it('uses a fresh salt and iv every time', async () => {
    const [a, b] = await Promise.all([encrypt('x', 'p', FAST), encrypt('x', 'p', FAST)])
    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
  })

  it('rejects malformed envelopes', () => {
    expect(isEnvelope(null)).toBe(false)
    expect(
      isEnvelope({
        app: 'vector',
        format: 'encrypted',
        v: 1,
        salt: '',
        iv: '',
        data: '',
        iterations: 1,
      }),
    ).toBe(false)
  })

  it('encodes base64 for large buffers', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(fromBase64(toBase64(big))).toEqual(big)
  })

  it('derives the same identity on every device, different for each passphrase', async () => {
    const a = await syncIdentity('una frase', FAST)
    expect(a).toEqual(await syncIdentity('una frase', FAST))
    expect(a.id).toMatch(/^[0-9a-f]{64}$/)
    expect(a.id).not.toBe(a.token)
    expect((await syncIdentity('altra frase', FAST)).id).not.toBe(a.id)
  })

  it('generates and checks passphrases', () => {
    const p = generatePassphrase()
    expect(p.split(' ')).toHaveLength(7)
    for (const w of p.split(' ')) expect(words).toContain(w)
    expect(passphraseProblem(p)).toBeNull()
    expect(passphraseProblem('corta')).not.toBeNull()
    expect(passphraseProblem('una password lunga ventiquattro')).toBeNull()
  })
})

function memoryStore(): BlobStore & { data: Map<string, { value: string; meta: BlobMeta }> } {
  const data = new Map<string, { value: string; meta: BlobMeta }>()
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, value, meta) => void data.set(k, { value, meta }),
    delete: async (k) => void data.delete(k),
  }
}

describe('sync server', () => {
  const id = 'a'.repeat(64)
  const token = 'b'.repeat(64)
  const body = JSON.stringify({ format: 'encrypted', data: 'xyz' })
  const req = (
    method: string,
    extra: Record<string, string> = {},
    payload?: string,
    path = `/v1/${id}`,
  ) =>
    new Request(`https://sync.example${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, origin: 'https://app.example', ...extra },
      ...(payload === undefined ? {} : { body: payload }),
    })

  it('stores, versions and returns ciphertext', async () => {
    const env = { store: memoryStore(), allowedOrigin: 'https://app.example' }
    expect((await handle(req('GET'), env)).status).toBe(404)
    const put = await handle(req('PUT', { 'x-base-version': '0' }, body), env)
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ version: 1 })
    const get = await handle(req('GET'), env)
    expect(get.headers.get('x-version')).toBe('1')
    expect(get.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(await get.text()).toBe(body)
    expect(env.store.data.get(id)?.meta.tokenHash).toBe(await sha256Hex(token))
  })

  it('refuses conflicts, other tokens, plaintext and other origins', async () => {
    const env = { store: memoryStore(), allowedOrigin: 'https://app.example', maxBytes: 200 }
    await handle(req('PUT', { 'x-base-version': '0' }, body), env)
    const stale = await handle(req('PUT', { 'x-base-version': '0' }, body), env)
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: 'conflict', version: 1 })
    expect(
      (await handle(req('GET', { authorization: `Bearer ${'c'.repeat(64)}` }), env)).status,
    ).toBe(403)
    expect((await handle(req('GET', { authorization: 'Bearer nope' }), env)).status).toBe(401)
    expect(
      (await handle(req('PUT', { 'x-base-version': '1' }, '{"plain":true}'), env)).status,
    ).toBe(400)
    expect((await handle(req('PUT', { 'x-base-version': '1' }, 'not json'), env)).status).toBe(400)
    expect((await handle(req('PUT', { 'x-base-version': 'x' }, body), env)).status).toBe(400)
    expect(
      (
        await handle(
          req('PUT', { 'x-base-version': '1' }, `{"format":"encrypted","d":"${'x'.repeat(300)}"}`),
          env,
        )
      ).status,
    ).toBe(413)
    expect((await handle(req('GET', { origin: 'https://evil.example' }), env)).status).toBe(403)
    expect((await handle(req('OPTIONS'), env)).status).toBe(204)
    expect((await handle(req('GET', {}, undefined, '/v1/short'), env)).status).toBe(400)
    expect((await handle(req('GET', {}, undefined, '/other'), env)).status).toBe(404)
    expect((await handle(req('POST', {}, body), env)).status).toBe(405)
  })

  it('deletes', async () => {
    const env = { store: memoryStore(), allowedOrigin: '*' }
    await handle(req('PUT', { 'x-base-version': '0' }, body), env)
    expect((await handle(req('DELETE'), env)).status).toBe(204)
    expect(env.store.data.size).toBe(0)
  })
})
