/**
 * Focus from camera signals (PIANO-V3-LITE §5, ported and simplified from v2 focus.ts). Pure and
 * deterministic: the camera adapter turns each frame into a few numbers, the frame itself is
 * dropped at once, and only the aggregates are ever stored.
 */
import type { FocusAggregates, Sensitivity } from '../model/schemas'

/** One analysed frame (§5.2). Lives in memory only. */
export interface FrameSample {
  /** Milliseconds, monotonic. */
  timestamp: number
  facePresent: boolean
  /** Degrees, from the face transformation matrix. */
  yaw: number
  pitch: number
  roll: number
  /** Mean of eyeBlinkLeft and eyeBlinkRight, 0–1. */
  eyeClosedScore: number
  /** jawOpen blendshape, 0–1. */
  jawOpenScore: number
}

/** §5.5. In the interface: focused and micro-distraction read "Focused", distracted and absent
 * read "Away", fatigued reads "Break suggested". */
export type FocusState = 'focused' | 'micro-distraction' | 'distracted' | 'absent' | 'fatigued'

/** Why a state was reached: the "Why?" button lists these (§2.4). */
export type Signal = 'off-task-gaze' | 'no-face' | 'perclos' | 'eye-closure' | 'yawns' | 'restless'

export interface Posture {
  meanYaw: number
  sdYaw: number
  meanPitch: number
  sdPitch: number
}

/** Until the first calibration: looking at a screen, straight ahead. */
export const neutralPosture: Posture = { meanYaw: 0, sdYaw: 6, meanPitch: 0, sdPitch: 6 }

export interface FocusRules {
  /** A signal shorter than this is a micro-distraction and is ignored (§5.5). */
  briefSeconds: number
  /** No face for this long: absent, and the timer pauses. */
  absentSeconds: number
  /** No new break suggestion for this long after one (§5.5 cooldown). */
  cooldownSeconds: number
  /** Off-task gaze: |Δyaw| > max(minYaw, sigmas·σ) or |Δpitch| > max(minPitch, sigmas·σ). */
  minYaw: number
  minPitch: number
  sigmas: number
  /** Eyes count as closed above this score (§5.4 PERCLOS). */
  eyeClosed: number
  /** Share of closed-eye time in the last 60 s that reads as tired. */
  perclosHigh: number
  /** Eyes closed this long in a row is a prolonged closure. */
  closureSeconds: number
  yawnJaw: number
  yawnSeconds: number
  /** Yawns in 10 minutes that read as tired. */
  yawnsTired: number
  /** Head movement variance this many times the calibrated one reads as restless. */
  restlessRatio: number
}

const normal: FocusRules = {
  briefSeconds: 8,
  absentSeconds: 60,
  cooldownSeconds: 8 * 60,
  minYaw: 25,
  minPitch: 22,
  sigmas: 3,
  eyeClosed: 0.55,
  perclosHigh: 0.15,
  closureSeconds: 1.5,
  yawnJaw: 0.6,
  yawnSeconds: 1.5,
  yawnsTired: 3,
  restlessRatio: 3,
}

const lower: Record<Sensitivity, Sensitivity> = { high: 'normal', normal: 'low', low: 'low' }

/** Sensitivity scales the thresholds; Low means fewer interruptions. */
export function rulesFor(sensitivity: Sensitivity): FocusRules {
  const k = sensitivity === 'low' ? 1.3 : sensitivity === 'high' ? 0.8 : 1
  return {
    ...normal,
    minYaw: normal.minYaw * k,
    minPitch: normal.minPitch * k,
    sigmas: normal.sigmas * k,
    perclosHigh: normal.perclosHigh * k,
    restlessRatio: normal.restlessRatio * k,
  }
}

const windowMs = 60_000
const yawnWindowMs = 10 * 60_000

export interface FocusTracker {
  sensitivity: Sensitivity
  rules: FocusRules
  posture: Posture
  lastTimestamp: number | null
  /** The last 60 s, only the few numbers needed. */
  recent: { timestamp: number; closed: boolean; yaw: number; pitch: number }[]
  offTaskSince: number | null
  noFaceSince: number | null
  closedSince: number | null
  jawSince: number | null
  yawns: number[]
  state: FocusState
  signals: Signal[]
  lastSuggestionAt: number | null
  suggestionPending: boolean
  declined: number
  aggregates: FocusAggregates
}

export function startTracker(posture: Posture, sensitivity: Sensitivity): FocusTracker {
  return {
    sensitivity,
    rules: rulesFor(sensitivity),
    posture,
    lastTimestamp: null,
    recent: [],
    offTaskSince: null,
    noFaceSince: null,
    closedSince: null,
    jawSince: null,
    yawns: [],
    state: 'focused',
    signals: [],
    lastSuggestionAt: null,
    suggestionPending: false,
    declined: 0,
    aggregates: {
      activeSeconds: 0,
      focusedSeconds: 0,
      distractedSeconds: 0,
      awaySeconds: 0,
      distractionCount: 0,
      fatigueEvents: 0,
      breaksSuggested: 0,
      breaksAccepted: 0,
      focusScorePct: 100,
    },
  }
}

/** Population variance; callers pass at least ten values. */
function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
}

/** Numbers behind a "Why?": what the last minute and the last ten minutes looked like. */
export interface Evidence {
  perclos: number
  yawns: number
  restlessness: number
}

export function evidence(t: FocusTracker): Evidence {
  const closed = t.recent.filter((x) => x.closed).length
  const baseline = Math.max(1, t.posture.sdYaw ** 2 + t.posture.sdPitch ** 2)
  return {
    perclos: t.recent.length > 0 ? closed / t.recent.length : 0,
    yawns: t.yawns.length,
    restlessness:
      t.recent.length >= 10
        ? (variance(t.recent.map((x) => x.yaw)) + variance(t.recent.map((x) => x.pitch))) / baseline
        : 0,
  }
}

export interface StepResult {
  tracker: FocusTracker
  /** True once the face has been gone for the absent threshold: pause the timer. */
  shouldPause: boolean
  /** True when a break should be offered now. */
  suggestBreak: boolean
}

const seconds = (from: number | null, to: number) => (from === null ? 0 : (to - from) / 1000)

export function step(prev: FocusTracker, s: FrameSample): StepResult {
  const r = prev.rules
  const p = prev.posture
  const now = s.timestamp
  const dt =
    prev.lastTimestamp === null ? 0 : Math.max(0, Math.min(2000, now - prev.lastTimestamp)) / 1000
  const t: FocusTracker = { ...prev, lastTimestamp: now, aggregates: { ...prev.aggregates } }

  // Off-task gaze is relative to the calibrated posture: reading a paper book with the head down
  // is not a distraction (§5.3).
  const yawLimit = Math.max(r.minYaw, r.sigmas * p.sdYaw)
  const pitchLimit = Math.max(r.minPitch, r.sigmas * p.sdPitch)
  const offTask =
    s.facePresent &&
    (Math.abs(s.yaw - p.meanYaw) > yawLimit || Math.abs(s.pitch - p.meanPitch) > pitchLimit)
  const closed = s.facePresent && s.eyeClosedScore > r.eyeClosed

  t.noFaceSince = s.facePresent ? null : (prev.noFaceSince ?? now)
  t.offTaskSince = offTask ? (prev.offTaskSince ?? now) : null
  t.closedSince = closed ? (prev.closedSince ?? now) : null

  // A yawn: the jaw open past the threshold for long enough, counted once.
  const jawOpen = s.facePresent && s.jawOpenScore > r.yawnJaw
  t.jawSince = jawOpen ? (prev.jawSince ?? now) : null
  t.yawns = prev.yawns.filter((y) => now - y <= yawnWindowMs)
  const jawFrom = prev.jawSince
  if (jawOpen && jawFrom !== null && seconds(jawFrom, now) >= r.yawnSeconds) {
    if (!t.yawns.some((y) => y >= jawFrom)) t.yawns = [...t.yawns, now]
  }

  t.recent = [
    ...prev.recent.filter((x) => now - x.timestamp <= windowMs),
    ...(s.facePresent ? [{ timestamp: now, closed, yaw: s.yaw, pitch: s.pitch }] : []),
  ]
  const e = evidence(t)

  const absentFor = seconds(t.noFaceSince, now)
  const offTaskFor = seconds(t.offTaskSince, now)
  const signals: Signal[] = []
  let state: FocusState = 'focused'
  if (absentFor >= r.absentSeconds) {
    state = 'absent'
    signals.push('no-face')
  } else if (absentFor >= r.briefSeconds || offTaskFor >= r.briefSeconds) {
    state = 'distracted'
    signals.push(absentFor >= r.briefSeconds ? 'no-face' : 'off-task-gaze')
  } else {
    if (e.perclos >= r.perclosHigh) signals.push('perclos')
    if (seconds(t.closedSince, now) >= r.closureSeconds) signals.push('eye-closure')
    if (e.yawns >= r.yawnsTired) signals.push('yawns')
    if (e.restlessness >= r.restlessRatio) signals.push('restless')
    const tired = signals.some((x) => x !== 'eye-closure')
    if (tired) state = 'fatigued'
    else if (absentFor > 0 || offTaskFor > 0) state = 'micro-distraction'
  }

  const a = t.aggregates
  const away = (x: FocusState) => x === 'distracted' || x === 'absent'
  if (away(state) && !away(prev.state)) a.distractionCount++
  if (state === 'fatigued' && prev.state !== 'fatigued') a.fatigueEvents++
  a.activeSeconds += dt
  if (state === 'absent' || (state === 'distracted' && absentFor > 0)) a.awaySeconds += dt
  else if (state === 'distracted') a.distractedSeconds += dt
  else a.focusedSeconds += dt
  a.focusScorePct =
    a.activeSeconds > 0 ? Math.round((a.focusedSeconds / a.activeSeconds) * 100) : 100
  t.state = state
  t.signals = signals

  // Break suggestions: at most one every 8 minutes, never while one waits for an answer.
  const cooled =
    prev.lastSuggestionAt === null || seconds(prev.lastSuggestionAt, now) >= r.cooldownSeconds
  const suggestBreak = state === 'fatigued' && cooled && !prev.suggestionPending
  if (suggestBreak) {
    t.lastSuggestionAt = now
    t.suggestionPending = true
    a.breaksSuggested++
  }

  return { tracker: t, shouldPause: absentFor >= r.absentSeconds, suggestBreak }
}

/** The learner answered a break suggestion. Two refusals lower the sensitivity one level (§5.5). */
export function answerBreak(t: FocusTracker, accepted: boolean): FocusTracker {
  const aggregates = { ...t.aggregates }
  if (accepted) aggregates.breaksAccepted++
  const declined = accepted ? t.declined : t.declined + 1
  const sensitivity = !accepted && declined === 2 ? lower[t.sensitivity] : t.sensitivity
  return {
    ...t,
    aggregates,
    declined,
    sensitivity,
    rules: rulesFor(sensitivity),
    suggestionPending: false,
  }
}

/** Calibration (§5.3): mean and spread of the natural working posture over 15 seconds. */
export function calibrate(samples: readonly FrameSample[]): Posture | null {
  const faces = samples.filter((s) => s.facePresent)
  if (faces.length < 20) return null
  const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length
  const yaw = faces.map((s) => s.yaw)
  const pitch = faces.map((s) => s.pitch)
  return {
    meanYaw: mean(yaw),
    sdYaw: Math.sqrt(variance(yaw)),
    meanPitch: mean(pitch),
    sdPitch: Math.sqrt(variance(pitch)),
  }
}
