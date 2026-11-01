import { msg } from '../i18n'
/**
 * Focus tracking from coarse signals. Pure and deterministic: the camera and the
 * microphone only produce booleans many times a second; images and sound never
 * leave the sensor code and are never stored.
 */

/** What the learner allowed. Everything sensor-related is off by default. */
export interface FocusSettings {
  camera: boolean
  mic: boolean
  phone: boolean
  /** The learner studies aloud: their own voice is fine. */
  aloud: boolean
  sound: boolean
}

export const defaultFocusSettings: FocusSettings = {
  camera: false,
  mic: false,
  phone: true,
  aloud: false,
  sound: false,
}

export interface FocusSample {
  /** Seconds since the start of tracking (monotonic). */
  t: number
  /** The app is not visible (another tab or window). */
  hidden: boolean
  /** null when the camera is off. */
  face: boolean | null
  lookingAway: boolean
  eyesClosed: boolean
  phone: boolean
  /** null when the microphone is off. */
  voice: boolean | null
  /** The learner's mouth is moving: the voice is theirs. */
  mouthMoving: boolean
}

export interface FocusRules {
  /** A distraction shorter than this is ignored (glancing at notes, a sneeze). */
  ignoreSeconds: number
  /** Away for this long and the session pauses. */
  pauseAfterSeconds: number
  /** Studying aloud: the learner's own voice is not a distraction. */
  aloud: boolean
}

export type Distraction = 'left' | 'away' | 'lookAway' | 'phone' | 'drowsy' | 'talking' | 'voices'

export const distractionLabel: Record<Distraction, string> = {
  left: msg('Sei uscito dall’app'),
  away: msg('Non ti vedo'),
  lookAway: msg('Stai guardando altrove'),
  phone: msg('Telefono in vista'),
  drowsy: msg('Occhi chiusi: fai una pausa?'),
  talking: msg('Stai parlando'),
  voices: msg('Voci intorno a te'),
}

/** The first matching condition wins: the most serious first. */
export function classify(s: FocusSample, rules: Pick<FocusRules, 'aloud'>): Distraction | null {
  if (s.hidden) return 'left'
  if (s.face === false) return 'away'
  if (s.phone) return 'phone'
  if (s.eyesClosed) return 'drowsy'
  if (s.lookingAway) return 'lookAway'
  if (s.voice) {
    if (s.face && s.mouthMoving) return rules.aloud ? null : 'talking'
    return 'voices'
  }
  return null
}

export interface FocusState {
  startedAt: number
  lastT: number
  seconds: number
  attentiveSeconds: number
  /** The condition currently going on and since when. */
  current: { kind: Distraction; since: number; counted: boolean } | null
  counts: Record<Distraction, number>
  /** True once the current distraction has lasted long enough to pause. */
  shouldPause: boolean
}

const zero = (): Record<Distraction, number> => ({
  left: 0,
  away: 0,
  lookAway: 0,
  phone: 0,
  drowsy: 0,
  talking: 0,
  voices: 0,
})

export function startFocus(t: number): FocusState {
  return {
    startedAt: t,
    lastT: t,
    seconds: 0,
    attentiveSeconds: 0,
    current: null,
    counts: zero(),
    shouldPause: false,
  }
}

/** Distractions that make the learner unable to study: these can pause the session. */
const pausing: readonly Distraction[] = ['left', 'away', 'phone', 'drowsy']

export function step(state: FocusState, s: FocusSample, rules: FocusRules): FocusState {
  const dt = Math.max(0, Math.min(5, s.t - state.lastT)) // a sleeping laptop is not study time
  const kind = classify(s, rules)
  let current = state.current
  const counts = { ...state.counts }

  if (!kind) current = null
  else if (!current || current.kind !== kind) current = { kind, since: s.t, counted: false }

  const lasted = current ? s.t - current.since : 0
  // Short distractions are forgiven and count as attentive time.
  const distracted = current !== null && lasted >= rules.ignoreSeconds
  if (current && distracted && !current.counted) {
    counts[current.kind]++
    current = { ...current, counted: true }
  }
  return {
    ...state,
    lastT: s.t,
    seconds: state.seconds + dt,
    attentiveSeconds: state.attentiveSeconds + (distracted ? 0 : dt),
    current,
    counts,
    shouldPause:
      current !== null && pausing.includes(current.kind) && lasted >= rules.pauseAfterSeconds,
  }
}

/** The visible distraction, if any: short ones are not shown either. */
export function visibleDistraction(state: FocusState, rules: FocusRules): Distraction | null {
  const c = state.current
  return c && state.lastT - c.since >= rules.ignoreSeconds ? c.kind : null
}

/** 0..1: share of time spent attentive. */
export function focusScore(state: Pick<FocusState, 'seconds' | 'attentiveSeconds'>): number {
  return state.seconds <= 0 ? 1 : state.attentiveSeconds / state.seconds
}

export interface FocusSummary {
  seconds: number
  attentiveSeconds: number
  lookAways: number
  phoneSeen: number
  talking: number
  drowsy: number
  leftApp: number
}

export function summarize(state: FocusState): FocusSummary {
  const c = state.counts
  return {
    seconds: Math.round(state.seconds),
    attentiveSeconds: Math.round(state.attentiveSeconds),
    lookAways: c.lookAway + c.away,
    phoneSeen: c.phone,
    talking: c.talking + c.voices,
    drowsy: c.drowsy,
    leftApp: c.left,
  }
}

/** Head yaw and pitch in degrees from a 4×4 column-major facial transformation matrix. */
export function headAngles(m: ArrayLike<number>): { yaw: number; pitch: number } {
  const r02 = m[8] ?? 0
  const r12 = m[9] ?? 0
  const r22 = m[10] ?? 1
  const deg = 180 / Math.PI
  return {
    yaw: Math.atan2(r02, r22) * deg,
    pitch: Math.atan2(-r12, Math.hypot(r02, r22)) * deg,
  }
}

/** Mouth movement: the jaw opening changes over the last second (speaking), not just open. */
export function isMouthMoving(jawOpen: readonly number[], threshold = 0.04): boolean {
  if (jawOpen.length < 4) return false
  const mean = jawOpen.reduce((a, b) => a + b, 0) / jawOpen.length
  const variance = jawOpen.reduce((a, b) => a + (b - mean) ** 2, 0) / jawOpen.length
  return Math.sqrt(variance) > threshold
}

/**
 * Voice activity from loudness, adaptive to the room: the noise floor follows quiet moments,
 * and a voice is a level clearly above it.
 */
export interface VoiceDetector {
  floor: number
  active: boolean
  hold: number
}

export function startVoice(): VoiceDetector {
  return { floor: 0.01, active: false, hold: 0 }
}

export function stepVoice(v: VoiceDetector, rms: number, dt: number): VoiceDetector {
  const floor = rms < v.floor * 2 ? v.floor * 0.95 + rms * 0.05 : v.floor * 0.999 + rms * 0.001
  const loud = rms > Math.max(0.02, floor * 3)
  // Keep "active" for a moment through the pauses between words.
  const hold = loud ? 0.4 : Math.max(0, v.hold - dt)
  return { floor: Math.max(0.001, floor), active: loud || hold > 0, hold }
}
