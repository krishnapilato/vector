/**
 * VFR radiotelephony in English (ICAO Annex 10 / Doc 9432, as taught for the EASA PPL).
 * Every exercise is generated with fresh values, so it trains listening and readback,
 * not memory of a script.
 */
import { pick, type Rng, randomInt } from '../random'

export const alphabet: Record<string, string> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  F: 'Foxtrot',
  G: 'Golf',
  H: 'Hotel',
  I: 'India',
  J: 'Juliett',
  K: 'Kilo',
  L: 'Lima',
  M: 'Mike',
  N: 'November',
  O: 'Oscar',
  P: 'Papa',
  Q: 'Quebec',
  R: 'Romeo',
  S: 'Sierra',
  T: 'Tango',
  U: 'Uniform',
  V: 'Victor',
  W: 'Whiskey',
  X: 'X-ray',
  Y: 'Yankee',
  Z: 'Zulu',
}

/** ICAO pronunciation, as written in phraseology manuals. */
const digitWords = ['zero', 'one', 'two', 'tree', 'four', 'fife', 'six', 'seven', 'eight', 'niner']
/** What a speech engine should say to sound right. */
const digitSpeech = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'niner',
]

export function digits(n: string, speech = false): string {
  const words = speech ? digitSpeech : digitWords
  return [...n]
    .map((c) => (c === '.' ? (speech ? 'decimal' : 'decimal') : (words[Number(c)] ?? c)))
    .join(' ')
}

export function spell(callsign: string): string {
  return [...callsign.replace(/[^A-Z0-9]/gi, '').toUpperCase()]
    .map((c) => alphabet[c] ?? digitWords[Number(c)] ?? c)
    .join(' ')
}

/** I-ABCD → I-CD (first and last two letters), as ATC may abbreviate after first contact. */
export function abbreviate(callsign: string): string {
  const letters = callsign.replace(/[^A-Z]/gi, '').toUpperCase()
  return `${letters[0]}${letters.slice(-2)}`
}

/** Normalizes a spoken or typed answer: phonetic words → letters, number words → digits. */
export function normalize(text: string): string {
  const map: Record<string, string> = {
    zero: '0',
    one: '1',
    wun: '1',
    two: '2',
    three: '3',
    tree: '3',
    four: '4',
    fower: '4',
    five: '5',
    fife: '5',
    six: '6',
    seven: '7',
    eight: '8',
    ait: '8',
    nine: '9',
    niner: '9',
    decimal: '.',
    point: '.',
    dayseemal: '.',
  }
  const letters: Record<string, string> = {}
  for (const [k, v] of Object.entries(alphabet)) letters[v.toLowerCase().replace('-', '')] = k
  letters.alpha = 'A'
  letters.juliet = 'J'
  letters.whisky = 'W'
  letters.xray = 'X'
  const tokens = text
    .toLowerCase()
    .replace(/x-ray/g, 'xray')
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(/[^a-z0-9.]+/)
    .filter(Boolean)
  const out: string[] = []
  let last: 'd' | 'l' | 'w' = 'w'
  const push = (piece: string, kind: 'd' | 'l') => {
    if (last !== 'w' && last !== kind) out.push(' ')
    out.push(piece)
    last = kind
  }
  for (const t of tokens) {
    if (map[t] !== undefined) push(map[t] as string, 'd')
    else if (letters[t]) push(letters[t] as string, 'l')
    else if (/^[\d.]+$/.test(t)) push(t, 'd')
    else {
      out.push(` ${t} `)
      last = 'w'
    }
  }
  // Glue consecutive single characters (digits/letters) into runs: "1 2 0 . 4" → "120.4".
  return out.join('').replace(/\s+/g, ' ').trim()
}

export interface Required {
  /** What to check, in Italian, shown to the learner. */
  label: string
  /** Accepted forms after normalize(); any one is enough. */
  accept: string[]
}

export interface Exchange {
  /** What ATC says, in written phraseology. */
  atc: string
  /** The same, for the speech engine. */
  atcSpeech: string
  /** What the learner is asked to do, in Italian. */
  task: string
  /** A model answer. */
  model: string
  required: Required[]
}

export interface Scenario {
  id: string
  title: string
  /** Situation in Italian. */
  situation: string
  exchanges: Exchange[]
}

const stations = [
  { name: 'Milano Information', freq: '126.750' },
  { name: 'Venegono Radio', freq: '122.005' },
  { name: 'Bresso Tower', freq: '122.155' },
  { name: 'Novara Radio', freq: '123.300' },
  { name: 'Lugano Tower', freq: '119.150' },
  { name: 'Parma Tower', freq: '118.900' },
]

const runways = ['08', '14', '17', '26', '32', '35', '36', '27', '09', '22']

function callsignFor(rng: Rng): string {
  const L = 'ABCDEFGHILMNOPRSTUVZ'
  return `I-${Array.from({ length: 4 }, () => L[randomInt(rng, 0, L.length - 1)]).join('')}`
}

const opposite = (rwy: string) => String(((Number(rwy) + 18 - 1) % 36) + 1).padStart(2, '0')

export function freqText(f: string): string {
  // Six-digit frequencies drop trailing zeros except one after the decimal, as spoken.
  const [a, b = ''] = f.split('.')
  const trimmed = b.replace(/0+$/, '') || '0'
  return `${a}.${trimmed}`
}

/** Generates one scenario with fresh callsign, runway, QNH, squawk and frequencies. */
export function generateScenario(rng: Rng, kind?: string): Scenario {
  const cs = callsignFor(rng)
  const full = spell(cs)
  const short = spell(abbreviate(cs))
  const fullN = normalize(full)
  const shortN = normalize(short)
  const callsign: Required = { label: 'Nominativo', accept: [fullN, shortN] }
  const twr = pick(
    rng,
    stations.filter((s) => s.name.endsWith('Tower')),
  )
  const info = stations[0] as (typeof stations)[number]
  const rwy = pick(rng, runways)
  const qnh = String(randomInt(rng, 995, 1032))
  const squawk = `${randomInt(rng, 1, 6)}${randomInt(rng, 0, 7)}${randomInt(rng, 0, 7)}${randomInt(rng, 0, 7)}`
  const windDir = String(
    Math.round(((Number(rwy) * 10 + randomInt(rng, -30, 30) + 360) % 360) / 10) * 10 || 360,
  ).padStart(3, '0')
  const windKt = String(randomInt(rng, 3, 15))
  const holding = pick(rng, ['A', 'B', 'C', 'D'])
  const side = pick(rng, ['left', 'right'])

  const say = (
    text: string,
    speech: string,
    rest: Omit<Exchange, 'atc' | 'atcSpeech'>,
  ): Exchange => ({
    atc: text,
    atcSpeech: speech,
    ...rest,
  })

  const all: Record<string, () => Scenario> = {
    taxi: () => ({
      id: 'taxi',
      title: 'Rullaggio per la partenza',
      situation: `Sei ${cs} al parcheggio di ${twr.name.replace(' Tower', '')}, VFR. Hai chiesto il rullaggio.`,
      exchanges: [
        say(
          `${full}, taxi to holding point ${holding} runway ${rwy}, QNH ${qnh}.`,
          `${full}, taxi to holding point ${alphabet[holding]}, runway ${digits(rwy, true)}, Q N H ${digits(qnh, true)}.`,
          {
            task: 'Collaziona (readback) l’autorizzazione al rullaggio.',
            model: `Taxi to holding point ${holding} runway ${rwy}, QNH ${qnh}, ${short}.`,
            required: [
              {
                label: 'Punto attesa',
                accept: [
                  normalize(`holding point ${alphabet[holding]}`),
                  `holding point ${holding.toLowerCase()}`,
                ],
              },
              { label: `Pista ${rwy}`, accept: [normalize(rwy)] },
              { label: `QNH ${qnh}`, accept: [normalize(qnh)] },
              callsign,
            ],
          },
        ),
      ],
    }),
    squawk: () => ({
      id: 'squawk',
      title: 'Codice transponder',
      situation: `Sei ${cs} in volo VFR, in contatto con ${info.name}.`,
      exchanges: [
        say(`${short}, squawk ${squawk}.`, `${short}, squawk ${digits(squawk, true)}.`, {
          task: 'Collaziona il codice transponder.',
          model: `Squawk ${squawk}, ${short}.`,
          required: [{ label: `Squawk ${squawk}`, accept: [normalize(squawk)] }, callsign],
        }),
      ],
    }),
    frequency: () => {
      const f = freqText(info.freq)
      return {
        id: 'frequency',
        title: 'Cambio di frequenza',
        situation: `Sei ${cs} appena decollato da ${twr.name.replace(' Tower', '')}.`,
        exchanges: [
          say(
            `${short}, contact ${info.name} ${f}.`,
            `${short}, contact ${info.name} ${digits(f, true)}.`,
            {
              task: 'Collaziona il cambio di frequenza.',
              model: `${info.name} ${f}, ${short}.`,
              required: [{ label: `Frequenza ${f}`, accept: [normalize(f)] }, callsign],
            },
          ),
        ],
      }
    },
    circuit: () => ({
      id: 'circuit',
      title: 'Ingresso in circuito',
      situation: `Sei ${cs} in arrivo VFR a ${twr.name.replace(' Tower', '')}.`,
      exchanges: [
        say(
          `${short}, join ${side} hand downwind runway ${rwy}, QNH ${qnh}, report downwind.`,
          `${short}, join ${side} hand downwind, runway ${digits(rwy, true)}, Q N H ${digits(qnh, true)}, report downwind.`,
          {
            task: 'Collaziona l’istruzione di ingresso in circuito.',
            model: `Join ${side} hand downwind runway ${rwy}, QNH ${qnh}, wilco, ${short}.`,
            required: [
              {
                label: `Sottovento ${side === 'left' ? 'sinistro' : 'destro'}`,
                accept: [`${side} hand downwind`, `${side} downwind`],
              },
              { label: `Pista ${rwy}`, accept: [normalize(rwy)] },
              { label: `QNH ${qnh}`, accept: [normalize(qnh)] },
              callsign,
            ],
          },
        ),
      ],
    }),
    landing: () => ({
      id: 'landing',
      title: 'Autorizzazione all’atterraggio',
      situation: `Sei ${cs} in finale per la pista ${rwy}.`,
      exchanges: [
        say(
          `${short}, wind ${windDir} degrees ${windKt} knots, runway ${rwy} cleared to land.`,
          `${short}, wind ${digits(windDir, true)} degrees, ${digits(windKt, true)} knots, runway ${digits(rwy, true)}, cleared to land.`,
          {
            task: 'Collaziona l’autorizzazione all’atterraggio (il vento non va ripetuto).',
            model: `Runway ${rwy} cleared to land, ${short}.`,
            required: [
              { label: `Pista ${rwy}`, accept: [normalize(rwy)] },
              { label: 'Autorizzato ad atterrare', accept: ['cleared to land'] },
              callsign,
            ],
          },
        ),
      ],
    }),
    takeoff: () => ({
      id: 'takeoff',
      title: 'Autorizzazione al decollo',
      situation: `Sei ${cs} al punto attesa della pista ${rwy}, pronto.`,
      exchanges: [
        say(
          `${short}, runway ${rwy} cleared for take-off, wind ${windDir} degrees ${windKt} knots.`,
          `${short}, runway ${digits(rwy, true)}, cleared for take off, wind ${digits(windDir, true)} degrees, ${digits(windKt, true)} knots.`,
          {
            task: 'Collaziona l’autorizzazione al decollo.',
            model: `Runway ${rwy} cleared for take-off, ${short}.`,
            required: [
              { label: `Pista ${rwy}`, accept: [normalize(rwy)] },
              {
                label: 'Autorizzato al decollo',
                accept: ['cleared for take off', 'cleared for takeoff', 'cleared take off'],
              },
              callsign,
            ],
          },
        ),
      ],
    }),
    holdShort: () => ({
      id: 'holdShort',
      title: 'Attesa prima della pista',
      situation: `Sei ${cs} in rullaggio verso la pista ${rwy}; c’è traffico in finale.`,
      exchanges: [
        say(
          `${short}, hold short of runway ${rwy}, traffic on final.`,
          `${short}, hold short of runway ${digits(rwy, true)}, traffic on final.`,
          {
            task: 'Collaziona l’istruzione di attesa (va sempre ripetuta).',
            model: `Holding short runway ${rwy}, ${short}.`,
            required: [
              { label: 'Attesa prima della pista', accept: ['holding short', 'hold short'] },
              { label: `Pista ${rwy}`, accept: [normalize(rwy)] },
              callsign,
            ],
          },
        ),
      ],
    }),
    firstCall: () => ({
      id: 'firstCall',
      title: 'Prima chiamata',
      situation: `Sei ${cs}, Cessna 172, 10 miglia a nord di ${twr.name.replace(' Tower', '')} a 2500 piedi, VFR, e vuoi atterrare.`,
      exchanges: [
        say('(Fai tu la prima chiamata.)', '', {
          task: `Chiama ${twr.name}: chi chiami, chi sei, dove sei, cosa vuoi.`,
          model: `${twr.name}, ${full}, Cessna 172, 10 miles north, 2500 feet, VFR, request joining instructions for landing.`,
          required: [
            { label: 'Ente chiamato', accept: [twr.name.toLowerCase()] },
            { label: 'Nominativo completo', accept: [fullN] },
            { label: 'Posizione', accept: ['north'] },
            {
              label: 'Quota',
              accept: [
                '2500',
                '2 5 0 0',
                normalize('two thousand five hundred'),
                'two thousand five hundred',
              ],
            },
            { label: 'Richiesta', accept: ['request', 'landing', 'joining'] },
          ],
        }),
      ],
    }),
    opposite: () => ({
      id: 'opposite',
      title: 'Cambio pista in uso',
      situation: `Sei ${cs} sottovento; il vento è girato.`,
      exchanges: [
        say(
          `${short}, runway in use now ${opposite(rwy)}, QNH ${qnh}, report final.`,
          `${short}, runway in use now ${digits(opposite(rwy), true)}, Q N H ${digits(qnh, true)}, report final.`,
          {
            task: 'Collaziona la nuova pista e il QNH.',
            model: `Runway ${opposite(rwy)}, QNH ${qnh}, wilco, ${short}.`,
            required: [
              { label: `Pista ${opposite(rwy)}`, accept: [normalize(opposite(rwy))] },
              { label: `QNH ${qnh}`, accept: [normalize(qnh)] },
              callsign,
            ],
          },
        ),
      ],
    }),
  }
  const keys = Object.keys(all)
  const chosen = kind && all[kind] ? kind : pick(rng, keys)
  return (all[chosen] as () => Scenario)()
}

export const scenarioKinds = [
  'firstCall',
  'taxi',
  'holdShort',
  'takeoff',
  'frequency',
  'squawk',
  'circuit',
  'opposite',
  'landing',
] as const

export interface ReadbackResult {
  items: { label: string; ok: boolean }[]
  ok: boolean
}

/** Which required elements are in the answer. Order and filler words don't matter. */
export function checkReadback(answer: string, required: readonly Required[]): ReadbackResult {
  const text = ` ${normalize(answer).toLowerCase()} `
  const squash = text.replace(/\s+/g, '')
  const items = required.map((r) => ({
    label: r.label,
    ok: r.accept.some((a) => {
      const n = normalize(a).toLowerCase()
      // Numbers must stand alone: runway 26 is not inside QNH 1026.
      if (/^[\d.]+$/.test(n))
        return new RegExp(`(^|[^\\d.])${n.replace(/\./g, '\\.')}($|[^\\d])`).test(text)
      return text.includes(n) || squash.includes(n.replace(/\s+/g, ''))
    }),
  }))
  return { items, ok: items.every((i) => i.ok) }
}
