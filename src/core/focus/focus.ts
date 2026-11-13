/**
 * Focus from camera signals (PIANO-V3 §7, ported and simplified from v2 focus.ts). Pure and
 * deterministic: the camera adapter turns each frame into a few numbers, the frame itself is
 * dropped at once, and only the aggregates below are ever stored.
 */
import type { Calibration, FocusAggregate, Sensitivity } from '../model/schemas'

/** One analysed frame (§7.2). Lives in memory only. */
export interface FrameSample {
  /** Seconds since tracking started (monotonic). */
  t: number
  facePresent: boolean
  /** Degrees. */
  yaw: number
  pitch: number
  /** Mean of eyeBlinkLeft and eyeBlinkRight, 0–1. */
  blink: number
  jawOpen: number
  /**
   * Extra signals from the other models (ADR 0008), null when not measured. They run at 1–2 fps,
   * so the camera adapter repeats the latest value between runs.
   */
  /** A phone is in the picture (Object Detector). */
  phone: boolean | null
  /** Height of the shoulders, 0 at the top of the image and 1 at the bottom (Pose Landmarker). */
  shoulderY: number | null
  /** A hand rests on the face or under the chin (Hand Landmarker). */
  handOnFace: boolean | null
}

export type FocusState = 'focused' | 'distracted' | 'away' | 'tired'

export type FocusReason =
  | 'looking-away'
  | 'no-face'
  | 'perclos'
  | 'yawns'
  | 'restless'
  | 'eyes-closed'
  | 'phone'
  | 'stood-up'
  | 'slouching'
  | 'head-on-hand'

export interface FocusRules {
  /** Shorter distractions are ignored: a glance at the notes, a sneeze (§7.5). */
  briefSeconds: number
  /** No face for this long and the timer pauses. */
  awayPauseSeconds: number
  /** Minimum gap between two break suggestions. */
  suggestionGapSeconds: number
  /** Look-away thresholds: |Δyaw| > max(minYaw, k·σ), |Δpitch| > max(minPitch, k·σ). */
  minYaw: number
  minPitch: number
  sigmas: number
  /** Eyes count as closed above the reading baseline plus this margin. */
  blinkMargin: number
  closedSeconds: number
  perclosTired: number
  yawnJaw: number
  yawnSeconds: number
  yawnsTired: number
  restlessRatio: number
  /** Shoulders this much higher than when calibrated (share of image height): you stood up. */
  standRise: number
  /** Shoulders this much lower for a while: slumping in the chair. */
  slouchDrop: number
  slouchSeconds: number
  handOnFaceSeconds: number
}

const base: FocusRules = {
  briefSeconds: 8,
  awayPauseSeconds: 60,
  suggestionGapSeconds: 8 * 60,
  minYaw: 25,
  minPitch: 20,
  sigmas: 3,
  blinkMargin: 0.3,
  closedSeconds: 1.5,
  perclosTired: 0.15,
  yawnJaw: 0.6,
  yawnSeconds: 1.5,
  yawnsTired: 3,
  restlessRatio: 3,
  standRise: 0.18,
  slouchDrop: 0.1,
  slouchSeconds: 90,
  handOnFaceSeconds: 30,
}

/** Sensitivity scales the thresholds; low means fewer interruptions (§7.5). */
export function rulesFor(sensitivity: Sensitivity): FocusRules {
  const k = sensitivity === 'low' ? 1.3 : sensitivity === 'high' ? 0.8 : 1
  return {
    ...base,
    minYaw: base.minYaw * k,
    minPitch: base.minPitch * k,
    sigmas: base.sigmas * k,
    perclosTired: base.perclosTired * k,
    restlessRatio: base.restlessRatio * k,
  }
}

/** A calm default until the first calibration. */
export const uncalibrated: Calibration = {
  station: 'default',
  yawMean: 0,
  yawSd: 6,
  pitchMean: 15,
  pitchSd: 6,
  blinkMean: 0.2,
  shoulderY: null,
  date: 0,
}

const windowSeconds = 60
const yawnWindowSeconds = 10 * 60

export interface FocusTracker {
  rules: FocusRules
  calibration: Calibration
  lastT: number | null
  /** Recent samples for the 60 s window: only the few numbers needed. */
  recent: { t: number; closed: boolean; yaw: number; pitch: number }[]
  lookAwaySince: number | null
  noFaceSince: number | null
  closedSince: number | null
  jawSince: number | null
  phoneSince: number | null
  standSince: number | null
  slouchSince: number | null
  handSince: number | null
  yawns: number[]
  state: FocusState
  reasons: FocusReason[]
  /** The current distraction already counted. */
  counted: boolean
  lastSuggestionAt: number | null
  declined: number
  suggestionPending: boolean
  aggregate: FocusAggregate
  fatigueSum: number
  fatigueSamples: number
}

export function startTracker(calibration: Calibration, rules: FocusRules): FocusTracker {
  return {
    rules,
    calibration,
    lastT: null,
    recent: [],
    lookAwaySince: null,
    noFaceSince: null,
    closedSince: null,
    jawSince: null,
    phoneSince: null,
    standSince: null,
    slouchSince: null,
    handSince: null,
    yawns: [],
    state: 'focused',
    reasons: [],
    counted: false,
    lastSuggestionAt: null,
    declined: 0,
    suggestionPending: false,
    aggregate: {
      activeSeconds: 0,
      focusedSeconds: 0,
      distractedSeconds: 0,
      awaySeconds: 0,
      tiredSeconds: 0,
      distractions: 0,
      breaksSuggested: 0,
      breaksAccepted: 0,
      breaksDeclined: 0,
      attention: 1,
      fatigueAvg: 0,
      fatigueMax: 0,
    },
    fatigueSum: 0,
    fatigueSamples: 0,
  }
}

function variance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
}

/** Tiredness index 0–1: a hint, not a judgement (§7.5). Never called boredom. */
export function fatigueIndex(
  perclos: number,
  yawns: number,
  restless: number,
  r: FocusRules,
): number {
  const parts = [perclos / r.perclosTired, yawns / r.yawnsTired, restless / r.restlessRatio]
  return Math.min(1, Math.max(...parts) * 0.7 + (parts.reduce((a, b) => a + b, 0) / 3) * 0.3)
}

export interface StepResult {
  tracker: FocusTracker
  /** True once there has been no face for the pause threshold. */
  shouldPause: boolean
  /** True when a break should be offered now. */
  suggestBreak: boolean
}

export function step(prev: FocusTracker, s: FrameSample): StepResult {
  const r = prev.rules
  const c = prev.calibration
  const dt = prev.lastT === null ? 0 : Math.max(0, Math.min(2, s.t - prev.lastT))
  const t: FocusTracker = { ...prev, lastT: s.t, aggregate: { ...prev.aggregate } }

  // Per-frame signals, relative to the calibrated reading posture (§7.3).
  const yawLimit = Math.max(r.minYaw, r.sigmas * c.yawSd)
  const pitchLimit = Math.max(r.minPitch, r.sigmas * c.pitchSd)
  const lookingAway =
    s.facePresent &&
    (Math.abs(s.yaw - c.yawMean) > yawLimit || Math.abs(s.pitch - c.pitchMean) > pitchLimit)
  const closed = s.facePresent && s.blink > Math.min(0.95, c.blinkMean + r.blinkMargin)

  t.noFaceSince = s.facePresent ? null : (prev.noFaceSince ?? s.t)
  t.lookAwaySince = lookingAway ? (prev.lookAwaySince ?? s.t) : null
  t.closedSince = closed ? (prev.closedSince ?? s.t) : null

  // Extra signals (ADR 0008): only when the model measured them and calibration knows the posture.
  const standing =
    s.shoulderY !== null && c.shoulderY !== null && c.shoulderY - s.shoulderY > r.standRise
  const slouching =
    s.shoulderY !== null && c.shoulderY !== null && s.shoulderY - c.shoulderY > r.slouchDrop
  t.phoneSince = s.phone === true ? (prev.phoneSince ?? s.t) : null
  t.standSince = standing ? (prev.standSince ?? s.t) : null
  t.slouchSince = slouching ? (prev.slouchSince ?? s.t) : null
  t.handSince = s.handOnFace === true ? (prev.handSince ?? s.t) : null

  // Yawns: jaw open past the threshold for long enough, counted once each.
  const jawOpen = s.facePresent && s.jawOpen > r.yawnJaw
  t.jawSince = jawOpen ? (prev.jawSince ?? s.t) : null
  t.yawns = prev.yawns.filter((y) => s.t - y <= yawnWindowSeconds)
  if (jawOpen && prev.jawSince !== null && s.t - prev.jawSince >= r.yawnSeconds) {
    const since = prev.jawSince
    if (!t.yawns.some((y) => y >= since)) t.yawns = [...t.yawns, s.t]
  }

  t.recent = [
    ...prev.recent.filter((x) => s.t - x.t <= windowSeconds),
    ...(s.facePresent ? [{ t: s.t, closed, yaw: s.yaw, pitch: s.pitch }] : []),
  ]
  const perclos =
    t.recent.length > 0 ? t.recent.filter((x) => x.closed).length / t.recent.length : 0
  const baseline = Math.max(1, c.yawSd ** 2 + c.pitchSd ** 2)
  const restless =
    t.recent.length >= 10
      ? (variance(t.recent.map((x) => x.yaw)) + variance(t.recent.map((x) => x.pitch))) / baseline
      : 0
  const fatigue = fatigueIndex(perclos, t.yawns.length, restless, r)

  // State, most serious first (§7.5).
  const awayFor = t.noFaceSince === null ? 0 : s.t - t.noFaceSince
  const lookFor = t.lookAwaySince === null ? 0 : s.t - t.lookAwaySince
  const closedFor = t.closedSince === null ? 0 : s.t - t.closedSince
  const phoneFor = t.phoneSince === null ? 0 : s.t - t.phoneSince
  const standFor = t.standSince === null ? 0 : s.t - t.standSince
  const slouchFor = t.slouchSince === null ? 0 : s.t - t.slouchSince
  const handFor = t.handSince === null ? 0 : s.t - t.handSince
  const reasons: FocusReason[] = []
  let state: FocusState = 'focused'
  if (awayFor >= r.briefSeconds || standFor >= r.briefSeconds) {
    state = 'away'
    reasons.push(awayFor >= r.briefSeconds ? 'no-face' : 'stood-up')
  } else if (lookFor >= r.briefSeconds || phoneFor >= r.briefSeconds) {
    state = 'distracted'
    if (phoneFor >= r.briefSeconds) reasons.push('phone')
    if (lookFor >= r.briefSeconds) reasons.push('looking-away')
  } else {
    if (perclos >= r.perclosTired) reasons.push('perclos')
    if (t.yawns.length >= r.yawnsTired) reasons.push('yawns')
    if (restless >= r.restlessRatio) reasons.push('restless')
    if (closedFor >= r.closedSeconds) reasons.push('eyes-closed')
    if (slouchFor >= r.slouchSeconds) reasons.push('slouching')
    if (handFor >= r.handOnFaceSeconds) reasons.push('head-on-hand')
    if (reasons.some((x) => x !== 'eyes-closed')) state = 'tired'
  }

  const wasDistraction = prev.state === 'distracted' || prev.state === 'away'
  const isDistraction = state === 'distracted' || state === 'away'
  t.counted = isDistraction ? (wasDistraction ? prev.counted : false) : false
  if (isDistraction && !t.counted) {
    t.aggregate.distractions++
    t.counted = true
  }
  t.state = state
  t.reasons = reasons

  // Time per state. The first seconds of a distraction are forgiven (§7.5).
  const a = t.aggregate
  a.activeSeconds += dt
  if (state === 'away') a.awaySeconds += dt
  else if (state === 'distracted') a.distractedSeconds += dt
  else if (state === 'tired') a.tiredSeconds += dt
  else a.focusedSeconds += dt
  a.attention = a.activeSeconds > 0 ? (a.focusedSeconds + a.tiredSeconds) / a.activeSeconds : 1
  if (dt > 0) {
    t.fatigueSum = prev.fatigueSum + fatigue * dt
    t.fatigueSamples = prev.fatigueSamples + dt
  }
  a.fatigueAvg = t.fatigueSamples > 0 ? t.fatigueSum / t.fatigueSamples : 0
  a.fatigueMax = Math.max(prev.aggregate.fatigueMax, fatigue)

  // A break is offered at most every 8 minutes, and never while one is waiting for an answer.
  const gapOk =
    prev.lastSuggestionAt === null || s.t - prev.lastSuggestionAt >= r.suggestionGapSeconds
  const suggestBreak = state === 'tired' && gapOk && !prev.suggestionPending
  if (suggestBreak) {
    t.lastSuggestionAt = s.t
    t.suggestionPending = true
    a.breaksSuggested++
  }

  return {
    tracker: t,
    shouldPause: awayFor >= r.awayPauseSeconds || standFor >= r.awayPauseSeconds,
    suggestBreak,
  }
}

/** The learner answered a break suggestion. Two refusals lower the sensitivity (§7.5). */
export function answerBreak(t: FocusTracker, accepted: boolean): FocusTracker {
  const aggregate = { ...t.aggregate }
  if (accepted) aggregate.breaksAccepted++
  else aggregate.breaksDeclined++
  const declined = accepted ? t.declined : t.declined + 1
  const rules =
    !accepted && declined === 2
      ? {
          ...t.rules,
          perclosTired: t.rules.perclosTired * 1.3,
          yawnsTired: t.rules.yawnsTired + 1,
          restlessRatio: t.rules.restlessRatio * 1.3,
        }
      : t.rules
  return { ...t, aggregate, declined, rules, suggestionPending: false }
}

/** Calibration (§7.3): mean and spread of the reading posture over ~20 seconds. */
export function calibrate(
  station: string,
  samples: readonly FrameSample[],
  now: number,
): Calibration | null {
  const faces = samples.filter((s) => s.facePresent)
  if (faces.length < 20) return null
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = (xs: number[]) => Math.sqrt(variance(xs))
  const yaw = faces.map((s) => s.yaw)
  const pitch = faces.map((s) => s.pitch)
  return {
    station,
    yawMean: mean(yaw),
    yawSd: sd(yaw),
    pitchMean: mean(pitch),
    pitchSd: sd(pitch),
    blinkMean: Math.min(1, Math.max(0, mean(faces.map((s) => s.blink)))),
    shoulderY: (() => {
      const ys = faces.map((s) => s.shoulderY).filter((y): y is number => y !== null)
      return ys.length >= 10 ? mean(ys) : null
    })(),
    date: now,
  }
}
