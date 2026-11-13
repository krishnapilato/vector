/** Synthetic frame sequences only: no real recordings are ever used (PIANO-V3-LITE F2). */
import { describe, expect, it } from 'vitest'
import {
  answerBreak,
  calibrate,
  evidence,
  type FocusTracker,
  type FrameSample,
  neutralPosture,
  rulesFor,
  startTracker,
  step,
} from './focus'

const fps = 6
const working: Omit<FrameSample, 'timestamp'> = {
  facePresent: true,
  yaw: 0,
  pitch: 0,
  roll: 0,
  eyeClosedScore: 0.1,
  jawOpenScore: 0.05,
}

/** Runs `secs` of identical frames at 6 fps, starting at `from` seconds. */
function run(tracker: FocusTracker, from: number, secs: number, frame: Partial<FrameSample> = {}) {
  let t = tracker
  let paused = false
  let suggestions = 0
  const states = new Set<string>()
  for (let i = 0; i < secs * fps; i++) {
    const r = step(t, { ...working, ...frame, timestamp: (from + i / fps) * 1000 })
    t = r.tracker
    paused ||= r.shouldPause
    if (r.suggestBreak) suggestions++
    states.add(t.state)
  }
  return { tracker: t, paused, suggestions, states, end: from + secs }
}

const fresh = () => startTracker(neutralPosture, 'normal')

describe('focus states (§5.5)', () => {
  it('stays focused while working in the calibrated posture', () => {
    const r = run(fresh(), 0, 120)
    expect(r.tracker.state).toBe('focused')
    expect(r.tracker.aggregates.focusScorePct).toBe(100)
    expect(r.tracker.aggregates.distractionCount).toBe(0)
  })

  it('does not count reading a book with the head down once calibrated', () => {
    const book = { meanYaw: 0, sdYaw: 4, meanPitch: 30, sdPitch: 5 }
    const r = run(startTracker(book, 'normal'), 0, 60, { pitch: 32 })
    expect(r.tracker.state).toBe('focused')
  })

  it('ignores a micro-distraction under 8 s (drinking water, taking notes)', () => {
    let r = run(fresh(), 0, 30)
    r = run(r.tracker, r.end, 5, { yaw: 50 })
    expect(r.states.has('micro-distraction')).toBe(true)
    r = run(r.tracker, r.end, 30)
    expect(r.tracker.aggregates.distractionCount).toBe(0)
    expect(r.tracker.aggregates.focusScorePct).toBe(100)
  })

  it('counts looking away for 8 s or more as one distraction', () => {
    let r = run(fresh(), 0, 30)
    r = run(r.tracker, r.end, 20, { pitch: 40 })
    expect(r.tracker.state).toBe('distracted')
    expect(r.tracker.signals).toEqual(['off-task-gaze'])
    r = run(r.tracker, r.end, 30)
    expect(r.tracker.aggregates.distractionCount).toBe(1)
    expect(r.tracker.aggregates.distractedSeconds).toBeGreaterThan(10)
  })

  it('reads a short absence as away, and pauses only after 60 s', () => {
    let r = run(fresh(), 0, 10)
    r = run(r.tracker, r.end, 50, { facePresent: false })
    expect(r.tracker.state).toBe('distracted')
    expect(r.tracker.signals).toEqual(['no-face'])
    expect(r.paused).toBe(false)
    r = run(r.tracker, r.end, 15, { facePresent: false })
    expect(r.tracker.state).toBe('absent')
    expect(r.paused).toBe(true)
    expect(r.tracker.aggregates.awaySeconds).toBeGreaterThan(55)
    expect(r.tracker.aggregates.distractionCount).toBe(1)
  })
})

describe('fatigue and break suggestions', () => {
  it('suggests a break when PERCLOS is high', () => {
    const r = run(fresh(), 0, 90, { eyeClosedScore: 0.9 })
    expect(r.tracker.state).toBe('fatigued')
    expect(r.tracker.signals).toContain('perclos')
    expect(r.tracker.signals).toContain('eye-closure')
    expect(r.suggestions).toBe(1)
    expect(r.tracker.aggregates.fatigueEvents).toBe(1)
  })

  it('treats a single long blink as a hint, not tiredness', () => {
    const t = startTracker(neutralPosture, 'low')
    let r = run(t, 0, 60)
    r = run(r.tracker, r.end, 2, { eyeClosedScore: 0.9 })
    expect(r.tracker.signals).toEqual(['eye-closure'])
    expect(r.tracker.state).toBe('focused')
  })

  it('suggests a break after three yawns in ten minutes', () => {
    let r = run(fresh(), 0, 10)
    for (let i = 0; i < 3; i++) {
      r = run(r.tracker, r.end, 2, { jawOpenScore: 0.8 })
      r = run(r.tracker, r.end, 60)
    }
    expect(r.tracker.yawns).toHaveLength(3)
    expect(r.tracker.signals).toContain('yawns')
    expect(evidence(r.tracker).yawns).toBe(3)
  })

  it('reads marked head restlessness as tiredness', () => {
    let t = fresh()
    for (let i = 0; i < 60 * fps; i++)
      t = step(t, { ...working, yaw: i % 2 ? 20 : -20, timestamp: (i / fps) * 1000 }).tracker
    expect(t.signals).toContain('restless')
    expect(evidence(t).restlessness).toBeGreaterThan(3)
  })

  it('waits 8 minutes after a suggestion, answered or not', () => {
    let r = run(fresh(), 0, 60, { eyeClosedScore: 0.9 })
    expect(r.suggestions).toBe(1)
    let t = answerBreak(r.tracker, false)
    r = run(t, r.end, 5 * 60, { eyeClosedScore: 0.9 })
    expect(r.suggestions).toBe(0)
    r = run(r.tracker, r.end, 4 * 60, { eyeClosedScore: 0.9 })
    expect(r.suggestions).toBe(1)
    t = answerBreak(r.tracker, true)
    expect(t.aggregates.breaksAccepted).toBe(1)
    expect(t.aggregates.breaksSuggested).toBe(2)
  })

  it('never stacks a suggestion on one still waiting for an answer', () => {
    const r = run(fresh(), 0, 20 * 60, { eyeClosedScore: 0.9 })
    expect(r.suggestions).toBe(1)
  })

  it('lowers the sensitivity one level after two refusals', () => {
    const t = startTracker(neutralPosture, 'high')
    const once = answerBreak(t, false)
    expect(once.sensitivity).toBe('high')
    const twice = answerBreak(once, false)
    expect(twice.sensitivity).toBe('normal')
    expect(twice.rules.perclosHigh).toBeGreaterThan(t.rules.perclosHigh)
    const low = answerBreak(answerBreak(startTracker(neutralPosture, 'low'), false), false)
    expect(low.sensitivity).toBe('low')
  })
})

describe('aggregates and rules', () => {
  it('splits active time into focused, distracted and away', () => {
    let r = run(fresh(), 0, 60)
    r = run(r.tracker, r.end, 60, { yaw: 60 })
    const a = r.tracker.aggregates
    expect(a.activeSeconds).toBeCloseTo(120, 0)
    expect(a.focusScorePct).toBeGreaterThan(50)
    expect(a.focusScorePct).toBeLessThan(60)
    expect(a.focusedSeconds + a.distractedSeconds + a.awaySeconds).toBeCloseTo(a.activeSeconds)
  })

  it('caps the time between frames, so a sleeping laptop is not counted', () => {
    let t = fresh()
    t = step(t, { ...working, timestamp: 0 }).tracker
    t = step(t, { ...working, timestamp: 600_000 }).tracker
    expect(t.aggregates.activeSeconds).toBe(2)
  })

  it('stores numbers only', () => {
    for (const v of Object.values(run(fresh(), 0, 10).tracker.aggregates))
      expect(typeof v).toBe('number')
  })

  it('makes High more sensitive than Low', () => {
    expect(rulesFor('high').minYaw).toBeLessThan(rulesFor('normal').minYaw)
    expect(rulesFor('normal').minYaw).toBeLessThan(rulesFor('low').minYaw)
  })

  it('has no evidence before any frame', () => {
    expect(evidence(fresh())).toEqual({ perclos: 0, yawns: 0, restlessness: 0 })
  })
})

describe('calibration (§5.3)', () => {
  it('learns the natural posture', () => {
    const samples = Array.from({ length: 90 }, (_, i) => ({
      ...working,
      timestamp: (i / fps) * 1000,
      yaw: 5 + (i % 2 ? 2 : -2),
      pitch: 30,
    }))
    const p = calibrate(samples)
    expect(p?.meanYaw).toBeCloseTo(5)
    expect(p?.sdYaw).toBeCloseTo(2)
    expect(p?.meanPitch).toBeCloseTo(30)
    expect(p?.sdPitch).toBeCloseTo(0)
  })

  it('needs enough frames with a face', () => {
    expect(calibrate([{ ...working, timestamp: 0 }])).toBeNull()
  })
})
