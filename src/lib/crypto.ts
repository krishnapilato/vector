/**
 * Encryption with the browser's WebCrypto (ported from v2 src/core/sync/crypto.ts, file part).
 * The passphrase never leaves the device: backups and the sync vault carry ciphertext only.
 */
export const ITERATIONS = 600_000

const enc = new TextEncoder()

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function baseKey(passphrase: string) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.normalize('NFKC').trim()),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits'],
  )
}

async function aesKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    await baseKey(passphrase),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** An encrypted backup file. */
export interface Envelope {
  app: 'vector'
  format: 'encrypted'
  v: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  data: string
}

export async function encryptFile(plaintext: string, passphrase: string): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await aesKey(passphrase, salt, ITERATIONS)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await gzip(plaintext))
  return {
    app: 'vector',
    format: 'encrypted',
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  }
}

export class WrongPassphrase extends Error {}

export function isEnvelope(x: unknown): x is Envelope {
  const e = x as Partial<Envelope> | null
  return (
    !!e &&
    e.app === 'vector' &&
    e.format === 'encrypted' &&
    e.v === 1 &&
    typeof e.salt === 'string' &&
    typeof e.iv === 'string' &&
    typeof e.data === 'string' &&
    typeof e.iterations === 'number' &&
    e.iterations >= 100_000 &&
    e.iterations <= 10_000_000
  )
}

export async function decryptFile(envelope: Envelope, passphrase: string): Promise<string> {
  const key = await aesKey(passphrase, fromBase64(envelope.salt), envelope.iterations)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.data),
    )
    return await gunzip(new Uint8Array(plain))
  } catch {
    throw new WrongPassphrase()
  }
}

/** Where the vault lives, the token to write it and the key to read it: all from the passphrase. */
export async function vaultIdentity(
  passphrase: string,
  iterations = ITERATIONS,
): Promise<{ vaultId: string; token: string; key: CryptoKey }> {
  const base = await baseKey(passphrase)
  const bits = (label: string) =>
    crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`vector-vault-${label}`), iterations },
      base,
      256,
    )
  const [id, token] = await Promise.all([bits('id'), bits('token')])
  const key = await aesKey(passphrase, enc.encode('vector-vault-key'), iterations)
  return { vaultId: toHex(id), token: toHex(token), key }
}

export async function sealVault(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await gzip(plaintext))
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(data))}`
}

export async function openVault(sealed: string, key: CryptoKey): Promise<string> {
  const [v, iv, data] = sealed.split('.')
  if (v !== 'v1' || !iv || !data) throw new WrongPassphrase()
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(data),
    )
    return await gunzip(new Uint8Array(plain))
  } catch {
    throw new WrongPassphrase()
  }
}

/** A passphrase easy to type on a phone and hard to guess: 7 random words (~60 bits). */
const words = (
  'acorn alpine amber anchor apple arrow aspen atlas autumn badge banner basil beacon birch ' +
  'blossom bolt breeze brook cabin canyon cedar chalk cinder cliff clover cobalt comet coral ' +
  'crane creek crest dawn delta desert dune eagle echo ember falcon fern field fjord flint ' +
  'forest fossil frost garden glacier granite grove harbor hazel heron hollow horizon island ' +
  'ivory jasper juniper kestrel lagoon lantern larch lark linen lotus maple marble meadow ' +
  'mesa mint moss nectar north oak oasis ocean olive onyx orbit orchid otter pebble pine ' +
  'plume prairie quartz quill rain raven reef ridge river robin saffron sage sail sequoia ' +
  'shore sierra slate spruce star stone summit swift thistle thunder tide timber topaz tundra ' +
  'valley velvet violet walnut willow wind winter wren yarrow zenith zephyr'
).split(' ')

export function generatePassphrase(count = 7): string {
  const out: string[] = []
  const buf = new Uint32Array(count)
  crypto.getRandomValues(buf)
  for (const n of buf) out.push(words[n % words.length] ?? 'oak')
  return out.join(' ')
}

/** Null when the passphrase is long enough to protect the data. */
export function passphraseProblem(p: string): 'too-short' | null {
  const t = p.trim()
  return t.split(/\s+/).length < 5 && t.length < 24 ? 'too-short' : null
}
