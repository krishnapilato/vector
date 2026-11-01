import { msg } from '../i18n'
/**
 * End-to-end encryption for backups and sync, with the browser's WebCrypto.
 * The passphrase never leaves the device; the server only ever sees ciphertext,
 * a random-looking id and a hash of an access token derived from the passphrase.
 */

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

export const ITERATIONS = 600_000

const enc = new TextEncoder()
const dec = new TextDecoder()

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
  return crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
    'deriveBits',
  ])
}

async function aesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    await baseKey(passphrase),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encrypt(
  plaintext: string,
  passphrase: string,
  iterations = ITERATIONS,
): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await aesKey(passphrase, salt, iterations)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return {
    app: 'vector',
    format: 'encrypted',
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  }
}

export class WrongPassphrase extends Error {
  constructor() {
    super(msg('Frase segreta sbagliata, o file danneggiato.'))
  }
}

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
    e.iterations >= 1000 &&
    e.iterations <= 10_000_000
  )
}

export async function decrypt(envelope: Envelope, passphrase: string): Promise<string> {
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

/**
 * Where the data lives on the sync server and the token to write it. Both come from the
 * passphrase, so a second device with the same passphrase finds the same data.
 */
export async function syncIdentity(
  passphrase: string,
  iterations = ITERATIONS,
): Promise<{ id: string; token: string }> {
  const key = await baseKey(passphrase)
  const bits = (label: string) =>
    crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`vector-sync-${label}`), iterations },
      key,
      256,
    )
  const [id, token] = await Promise.all([bits('id'), bits('token')])
  return { id: toHex(id), token: toHex(token) }
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/** A passphrase that is easy to type on a phone and hard to guess: 7 random words. */
export const words = (
  'aereo ala alba altura ancora anello antenna aquila arco argento autunno avena baia balena ' +
  'banco barca bosco brezza bussola cabina campo canale candela capo carta casa castello cedro ' +
  'cielo cima collina cometa coniglio corda corsa costa cratere cupola delfino deserto diamante ' +
  'duna eco elica estate falco faro felce ferro fiamma fiume foglia fonte foresta fronte fumo ' +
  'gabbiano galassia gatto gelo ghianda giglio giardino golfo grano grotta isola lago lampo ' +
  'lana lanterna lente leone lino luna lupo marea mare melo menta miele miniera molo montagna ' +
  'muschio nebbia neve nido noce nube oasi oceano olivo onda orbita orso ostrica palma pane ' +
  'passo pendio perla pianura pietra pino pioggia pista polo ponte porto prato quarzo quercia ' +
  'radice rame ramo riva roccia rosa rotta rugiada sabbia sale salice scoglio seme sentiero ' +
  'sole sorgente stella stagno tempesta terra torre trifoglio tuono valle vela vento verde ' +
  'vetta vigna volpe vulcano zenit'
).split(' ')

export function generatePassphrase(count = 7): string {
  const out: string[] = []
  const buf = new Uint32Array(count)
  crypto.getRandomValues(buf)
  for (const n of buf) out.push(words[n % words.length] as string)
  return out.join(' ')
}

export function passphraseProblem(p: string): string | null {
  const t = p.trim()
  if (t.split(/\s+/).length < 5 && t.length < 24)
    return msg('Usa almeno 5 parole o 24 caratteri: è l’unica protezione dei tuoi dati.')
  return null
}
