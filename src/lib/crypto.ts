/**
 * Encryption of backup files with the browser's WebCrypto (ported from v2 crypto.ts, file part):
 * AES-256-GCM with a key derived from the passphrase (PBKDF2-SHA256, 600,000 rounds). The
 * passphrase never leaves the device and is never stored.
 */
export const ITERATIONS = 600_000

const enc = new TextEncoder()
const dec = new TextDecoder()

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function aesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.normalize('NFKC').trim()),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
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
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
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
    return dec.decode(plain)
  } catch {
    throw new WrongPassphrase()
  }
}

/** Null when the passphrase is long enough to protect the data. */
export function passphraseProblem(p: string): 'too-short' | null {
  const t = p.trim()
  return t.split(/\s+/).length < 5 && t.length < 24 ? 'too-short' : null
}
