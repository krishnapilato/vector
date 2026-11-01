/**
 * METAR and TAF decoding into plain Italian, for study. Not for flight planning.
 */
import { pick, type Rng, randomInt, shuffle } from '../random'

export interface Cloud {
  cover: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV'
  feet: number
  type: 'CB' | 'TCU' | null
}

export interface Metar {
  raw: string
  kind: 'METAR' | 'SPECI'
  station: string | null
  time: { day: number; hour: number; minute: number } | null
  auto: boolean
  wind: {
    dir: number | 'VRB'
    kt: number
    gust: number | null
    varFrom: number | null
    varTo: number | null
  } | null
  cavok: boolean
  visibility: { meters: number } | null
  weather: string[]
  clouds: Cloud[]
  noCloud: 'NSC' | 'NCD' | 'SKC' | 'CLR' | null
  temp: number | null
  dew: number | null
  qnh: number | null
  trend: string | null
  unknown: string[]
}

const coverLabel: Record<Cloud['cover'], string> = {
  FEW: 'poche nubi (1–2 ottavi)',
  SCT: 'nubi sparse (3–4 ottavi)',
  BKN: 'cielo molto nuvoloso (5–7 ottavi)',
  OVC: 'cielo coperto (8 ottavi)',
  VV: 'visibilità verticale',
}

const wxCodes: Record<string, string> = {
  MI: 'basso',
  BC: 'a banchi',
  PR: 'parziale',
  DR: 'scaccianeve basso',
  BL: 'scaccianeve alto',
  SH: 'rovesci di',
  TS: 'temporale',
  FZ: 'che gela',
  DZ: 'pioviggine',
  RA: 'pioggia',
  SN: 'neve',
  SG: 'granelli di neve',
  PL: 'ghiaccio granuloso',
  GR: 'grandine',
  GS: 'grandine piccola',
  UP: 'precipitazione sconosciuta',
  BR: 'foschia',
  FG: 'nebbia',
  FU: 'fumo',
  VA: 'cenere vulcanica',
  DU: 'polvere',
  SA: 'sabbia',
  HZ: 'caligine',
  PO: 'vortici di polvere',
  SQ: 'groppo',
  FC: 'tromba',
  SS: 'tempesta di sabbia',
  DS: 'tempesta di polvere',
}

export function describeWeather(code: string): string {
  let rest = code
  let intensity = ''
  if (rest.startsWith('+')) {
    intensity = 'forte'
    rest = rest.slice(1)
  } else if (rest.startsWith('-')) {
    intensity = 'debole'
    rest = rest.slice(1)
  }
  let vicinity = ''
  if (rest.startsWith('VC')) {
    vicinity = 'nelle vicinanze'
    rest = rest.slice(2)
  }
  const parts: string[] = []
  for (let i = 0; i < rest.length; i += 2)
    parts.push(wxCodes[rest.slice(i, i + 2)] ?? rest.slice(i, i + 2))
  return [parts.join(' '), intensity, vicinity].filter(Boolean).join(', ')
}

const WX =
  /^(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)+$|^(\+|-)?(TS|SH)$/

export function parseMetar(input: string): Metar {
  const raw = input.trim().replace(/\s+/g, ' ').replace(/=$/, '')
  const t = raw.split(' ')
  const m: Metar = {
    raw,
    kind: 'METAR',
    station: null,
    time: null,
    auto: false,
    wind: null,
    cavok: false,
    visibility: null,
    weather: [],
    clouds: [],
    noCloud: null,
    temp: null,
    dew: null,
    qnh: null,
    trend: null,
    unknown: [],
  }
  let i = 0
  if (t[i] === 'METAR' || t[i] === 'SPECI') m.kind = t[i++] as 'METAR' | 'SPECI'
  if (t[i] === 'COR') i++
  if (/^[A-Z]{4}$/.test(t[i] ?? '')) m.station = t[i++] ?? null
  const time = /^(\d\d)(\d\d)(\d\d)Z$/.exec(t[i] ?? '')
  if (time) {
    m.time = { day: Number(time[1]), hour: Number(time[2]), minute: Number(time[3]) }
    i++
  }
  if (t[i] === 'AUTO' || t[i] === 'NIL') {
    m.auto = t[i] === 'AUTO'
    i++
  }
  for (; i < t.length; i++) {
    const tok = t[i] as string
    const wind = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(tok)
    const vary = /^(\d{3})V(\d{3})$/.exec(tok)
    const sm = /^(\d+)SM$/.exec(tok)
    const cloud = /^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU)?$/.exec(tok)
    const temps = /^(M?\d{2})\/(M?\d{2})?$/.exec(tok)
    const q = /^Q(\d{4})$/.exec(tok)
    const a = /^A(\d{4})$/.exec(tok)
    if (tok === 'RMK') break
    if (['NOSIG', 'BECMG', 'TEMPO'].includes(tok)) {
      m.trend = t.slice(i).join(' ')
      break
    }
    if (wind) {
      const k = wind[4] === 'MPS' ? 1.944 : 1
      m.wind = {
        dir: wind[1] === 'VRB' ? 'VRB' : Number(wind[1]),
        kt: Math.round(Number(wind[2]) * k),
        gust: wind[3] ? Math.round(Number(wind[3]) * k) : null,
        varFrom: null,
        varTo: null,
      }
    } else if (vary && m.wind) {
      m.wind.varFrom = Number(vary[1])
      m.wind.varTo = Number(vary[2])
    } else if (tok === 'CAVOK') {
      m.cavok = true
      m.visibility = { meters: 10_000 }
    } else if (/^\d{4}$/.test(tok) && !m.visibility) {
      m.visibility = { meters: tok === '9999' ? 10_000 : Number(tok) }
    } else if (/^\d{4}(N|NE|E|SE|S|SW|W|NW)$/.test(tok)) {
      // minimum visibility in a direction: kept in raw
    } else if (sm) {
      m.visibility = { meters: Math.round(Number(sm[1]) * 1609) }
    } else if (cloud) {
      m.clouds.push({
        cover: cloud[1] as Cloud['cover'],
        feet: cloud[2] === '///' ? 0 : Number(cloud[2]) * 100,
        type: (cloud[3] as Cloud['type']) ?? null,
      })
    } else if (['NSC', 'NCD', 'SKC', 'CLR'].includes(tok)) {
      m.noCloud = tok as Metar['noCloud']
    } else if (temps) {
      const n = (s: string) => (s.startsWith('M') ? -Number(s.slice(1)) : Number(s))
      m.temp = n(temps[1] as string)
      m.dew = temps[2] ? n(temps[2]) : null
    } else if (q) {
      m.qnh = Number(q[1])
    } else if (a) {
      m.qnh = Math.round(Number(a[1]) * 0.338639)
    } else if (WX.test(tok)) {
      m.weather.push(tok)
    } else if (/^R\d{2}[LCR]?\//.test(tok) || /^RE/.test(tok) || /^WS/.test(tok)) {
      // runway visual range, recent weather, wind shear: kept in raw
    } else {
      m.unknown.push(tok)
    }
  }
  return m
}

/** Lowest broken or overcast layer (or vertical visibility), in feet. */
export function ceiling(m: Pick<Metar, 'clouds'>): number | null {
  const layers = m.clouds.filter((c) => c.cover === 'BKN' || c.cover === 'OVC' || c.cover === 'VV')
  return layers.length ? Math.min(...layers.map((c) => c.feet)) : null
}

/**
 * A rough reading for study, not a legal check: VFR at an aerodrome in controlled airspace needs
 * at least 5 km visibility and a 1500 ft ceiling (SERA.5005); marginal conditions are flagged.
 */
export function vfrHint(m: Metar): 'VMC' | 'marginale' | 'IMC' | null {
  if (!m.visibility && !m.cavok) return null
  const vis = m.visibility?.meters ?? 10_000
  const ceil = ceiling(m)
  if (vis < 1500 || (ceil !== null && ceil < 600)) return 'IMC'
  if (vis < 5000 || (ceil !== null && ceil < 1500)) return 'marginale'
  if (vis < 8000 || (ceil !== null && ceil < 3000) || m.weather.some((w) => w.includes('TS')))
    return 'marginale'
  return 'VMC'
}

export function describeMetar(m: Metar): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  if (m.station) out.push({ label: 'Aeroporto', value: m.station })
  if (m.time)
    out.push({
      label: 'Emesso',
      value: `giorno ${m.time.day} alle ${String(m.time.hour).padStart(2, '0')}:${String(m.time.minute).padStart(2, '0')} UTC${m.auto ? ' (automatico)' : ''}`,
    })
  if (m.wind) {
    const w = m.wind
    let v =
      w.kt === 0
        ? 'calmo'
        : `${w.dir === 'VRB' ? 'variabile' : `da ${String(w.dir).padStart(3, '0')}°`} a ${w.kt} nodi`
    if (w.gust) v += `, raffiche ${w.gust} nodi`
    if (w.varFrom !== null) v += `, variabile tra ${w.varFrom}° e ${w.varTo}°`
    out.push({ label: 'Vento', value: v })
  }
  if (m.cavok)
    out.push({
      label: 'CAVOK',
      value:
        'visibilità ≥ 10 km, nessuna nube sotto 5000 ft né CB/TCU, nessun fenomeno significativo',
    })
  else if (m.visibility)
    out.push({
      label: 'Visibilità',
      value: m.visibility.meters >= 10_000 ? '10 km o più' : `${m.visibility.meters} m`,
    })
  for (const w of m.weather) out.push({ label: 'Fenomeni', value: `${w}: ${describeWeather(w)}` })
  for (const c of m.clouds)
    out.push({
      label: 'Nubi',
      value: `${coverLabel[c.cover]} a ${c.feet} ft${c.type === 'CB' ? ', cumulonembi' : c.type === 'TCU' ? ', cumuli torreggianti' : ''}`,
    })
  if (m.noCloud)
    out.push({
      label: 'Nubi',
      value: m.noCloud === 'NSC' ? 'nessuna nube significativa' : 'nessuna nube rilevata',
    })
  if (m.temp !== null)
    out.push({
      label: 'Temperatura',
      value: `${m.temp} °C, rugiada ${m.dew ?? '—'} °C${m.dew !== null && m.temp - m.dew <= 2 ? ' (aria quasi satura: possibile nebbia o nubi basse)' : ''}`,
    })
  if (m.qnh !== null) out.push({ label: 'QNH', value: `${m.qnh} hPa` })
  if (m.trend)
    out.push({
      label: 'Tendenza',
      value: m.trend.startsWith('NOSIG')
        ? 'nessun cambiamento significativo nelle prossime 2 ore'
        : m.trend,
    })
  if (m.unknown.length) out.push({ label: 'Non decodificato', value: m.unknown.join(' ') })
  return out
}

/** TAF: split into the base forecast and change groups, each decoded like a METAR body. */
export function parseTaf(input: string): {
  header: string
  groups: { label: string; body: Metar }[]
} {
  const raw = input.trim().replace(/\s+/g, ' ').replace(/=$/, '')
  const parts = raw.split(/ (?=(?:BECMG|TEMPO|FM\d{6}|PROB\d{2}(?: TEMPO)?) )/)
  const first = parts[0] ?? ''
  const head = /^(TAF(?: AMD| COR)? [A-Z]{4} \d{6}Z (\d{4}\/\d{4}))/.exec(first)
  const groups = parts.map((p, i) => {
    const label =
      i === 0
        ? `Previsione base${head?.[2] ? ` (validità ${head[2]})` : ''}`
        : (/^(BECMG|TEMPO|FM\d{6}|PROB\d{2}(?: TEMPO)?)( \d{4}\/\d{4})?/.exec(p)?.[0] ?? p)
            .replace('BECMG', 'In cambiamento')
            .replace(/^TEMPO/, 'Temporaneamente')
            .replace(/^PROB(\d{2})/, 'Probabilità $1%')
            .replace(/^FM(\d{2})(\d{2})(\d{2})/, 'Dalle $2:$3 del giorno $1')
    const body =
      i === 0 && head
        ? p.slice(head[1]?.length ?? 0)
        : p.replace(/^(BECMG|TEMPO|FM\d{6}|PROB\d{2}(?: TEMPO)?)( \d{4}\/\d{4})?/, '')
    return { label, body: parseMetar(body) }
  })
  return { header: head?.[1] ?? '', groups }
}

/* ---------- practice: generated METARs and questions ---------- */

const icaos = ['LIMC', 'LIML', 'LIME', 'LIMN', 'LIPZ', 'LIRF', 'LIPE', 'LIMJ', 'LIRN', 'LICC']

export function randomMetar(rng: Rng): string {
  const station = pick(rng, icaos)
  const day = String(randomInt(rng, 1, 28)).padStart(2, '0')
  const hour = String(randomInt(rng, 0, 23)).padStart(2, '0')
  const minute = pick(rng, ['20', '50'])
  const calm = rng() < 0.1
  const dir = String(randomInt(rng, 1, 36) * 10).padStart(3, '0')
  const kt = randomInt(rng, 2, 25)
  const gust = kt > 14 && rng() < 0.4 ? `G${kt + randomInt(rng, 8, 15)}` : ''
  const wind = calm ? '00000KT' : `${dir}${String(kt).padStart(2, '0')}${gust}KT`
  const temp = randomInt(rng, -5, 30)
  const dew = temp - randomInt(rng, 0, 12)
  const fmt = (n: number) =>
    n < 0 ? `M${String(-n).padStart(2, '0')}` : String(n).padStart(2, '0')
  const qnh = `Q${String(randomInt(rng, 990, 1035)).padStart(4, '0')}`
  if (rng() < 0.25)
    return `METAR ${station} ${day}${hour}${minute}Z ${wind} CAVOK ${fmt(temp)}/${fmt(dew)} ${qnh} NOSIG`
  const vis = pick(rng, ['9999', '8000', '6000', '4500', '3000', '1500', '0800'])
  const wx =
    Number(vis) < 5000
      ? pick(rng, ['BR', '-RA', 'RA', 'FG', '+SHRA', 'TSRA', '-SN'])
      : rng() < 0.2
        ? '-RA'
        : ''
  const layers = shuffle(rng, ['FEW', 'SCT', 'BKN', 'OVC'])
    .slice(0, randomInt(rng, 1, 3))
    .sort(
      (a, b) => ['FEW', 'SCT', 'BKN', 'OVC'].indexOf(a) - ['FEW', 'SCT', 'BKN', 'OVC'].indexOf(b),
    )
  let h = randomInt(rng, 3, 25)
  const clouds = layers.map((c) => {
    const s = `${c}${String(h).padStart(3, '0')}${wx.includes('TS') && c !== 'OVC' ? 'CB' : ''}`
    h += randomInt(rng, 5, 30)
    return s
  })
  return [
    `METAR ${station} ${day}${hour}${minute}Z`,
    wind,
    vis,
    wx,
    ...clouds,
    `${fmt(temp)}/${fmt(dew)}`,
    qnh,
    'NOSIG',
  ]
    .filter(Boolean)
    .join(' ')
}

export interface MetarQuestion {
  prompt: string
  answer: string
  options: string[]
}

/** A few multiple-choice questions on a METAR, with distractors near the truth. */
export function metarQuestions(m: Metar, rng: Rng): MetarQuestion[] {
  const qs: MetarQuestion[] = []
  const opts = (answer: string, others: string[]) =>
    shuffle(rng, [answer, ...[...new Set(others)].filter((o) => o !== answer).slice(0, 3)])
  if (m.wind && m.wind.dir !== 'VRB' && m.wind.kt > 0) {
    const d = m.wind.dir
    const a = `da ${String(d).padStart(3, '0')}° a ${m.wind.kt} nodi`
    qs.push({
      prompt: 'Da dove soffia il vento e a che velocità?',
      answer: a,
      options: opts(a, [
        `verso ${String(d).padStart(3, '0')}° a ${m.wind.kt} nodi`,
        `da ${String((d + 180) % 360 || 360).padStart(3, '0')}° a ${m.wind.kt} nodi`,
        `da ${String(d).padStart(3, '0')}° a ${m.wind.kt} km/h`,
        `da ${String((d + 90) % 360 || 360).padStart(3, '0')}° a ${m.wind.kt + 5} nodi`,
      ]),
    })
  }
  if (m.qnh !== null) {
    const a = `${m.qnh} hPa`
    qs.push({
      prompt: 'Che valore imposti nell’altimetro per leggere l’altitudine?',
      answer: a,
      options: opts(a, [`${m.qnh - 3} hPa`, `${m.qnh + 2} hPa`, `${m.qnh - 10} hPa`, '1013 hPa']),
    })
  }
  const ceil = ceiling(m)
  const a = ceil === null ? 'nessun ceiling' : `${ceil} ft`
  qs.push({
    prompt: 'Qual è il ceiling (base del primo strato BKN o OVC)?',
    answer: a,
    options: opts(a, [
      'nessun ceiling',
      ...m.clouds.map((c) => `${c.feet} ft`),
      `${(ceil ?? 3000) + 1000} ft`,
      `${Math.max(100, (ceil ?? 3000) - 500)} ft`,
    ]),
  })
  if (m.temp !== null && m.dew !== null) {
    const spread = m.temp - m.dew
    const ans = spread <= 2 ? 'alto: aria quasi satura' : 'basso'
    qs.push({
      prompt: `Temperatura ${m.temp} °C, rugiada ${m.dew} °C: rischio di nebbia o nubi basse?`,
      answer: ans,
      options: shuffle(rng, ['alto: aria quasi satura', 'basso']),
    })
  }
  return qs
}
