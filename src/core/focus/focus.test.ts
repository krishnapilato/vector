/** Synthetic sequences only: no real recordings are ever used (PIANO-V3 §7.8). */
import { describe, expect, it } from 'vitest'
import {
  answerBreak,
  calibrate,
  type FocusTracker,
  type FrameSample,
  rulesFor,
  startTracker,
  step,
  uncalibrated,
} from './focus'

const fps = 6
const reading = { facePresent: true, yaw: 0, pitch: 15, blink: 0.2, jawOpen: 0.05 }

/** Runs `seconds` of identical frames at 6 fps from time `from`. */
function run(
  tracker: FocusTracker,
  from: number,
  seconds: number,
  frame: Partial<Omit<FrameSample, 't'>> = {},
) {
  let t = tracker
  let paused = false
  let suggestions = 0
  for (let i = 0; i < seconds * fps; i++) {
    const r = step(t, { ...reading, ...frame, t: from + i / fps })
    t = r.tracker
    paused ||= r.shouldPause
    if (r.suggestBreak) suggestions++
  }
  return { tracker: t, paused, suggestions, end: from + seconds }
}

const fresh = () => startTracker(uncalibrated, rulesFor('normal'))

describe('focus states', () => {
  it('stays focused while reading in the calibrated posture', () => {
    const r = run(fresh(), 0, 120)
    expect(r.tracker.state).toBe('focused')
    expect(r.tracker.aggregate.attention).toBeCloseTo(1)
    expect(r.tracker.aggregate.distractions).toBe(0)
  })

  it('does not count looking down at the book as a distraction', () => {
    const r = run(fresh(), 0, 60, { pitch: 30 })
    expect(r.tracker.state).toBe('focused')
  })

  it('ignores a short glance away (< 8 s)', () => {
    let r = run(fresh(), 0, 30)
    r = run(r.tracker, r.end, 5, { yaw: 50 })
    r = run(r.tracker, r.end, 30)
    expect(r.tracker.aggregate.distractions).toBe(0)
    expect(r.tracker.aggregate.attention).toBeCloseTo(1)
  })

  it('counts looking away for 8 s or more once', () => {
    let r = run(fresh(), 0, 30)
    r = run(r.tracker, r.end, 20, { yaw: 50 })
    expect(r.tracker.state).toBe('distracted')
    r = run(r.tracker, r.end, 30)
    expect(r.tracker.aggregate.distractions).toBe(1)
    expect(r.tracker.aggregate.attention).toBeLessThan(1)
  })

  it('pauses the timer after 60 s without a face, not before', () => {
    let r = run(fresh(), 0, 10)
    r = run(r.tracker, r.end, 50, { facePresent: false })
    expect(r.paused).toBe(false)
    expect(r.tracker.state).toBe('away')
    r = run(r.tracker, r.end, 15, { facePresent: false })
    expect(r.paused).toBe(true)
  })
})

describe('tiredness and break suggestions', () => {
  it('offers a break when the eyes are often closed (PERCLOS)', () => {
    const r = run(fresh(), 0, 90, { blink: 0.9 })
    expect(r.tracker.state).toBe('tired')
    expect(r.tracker.reasons).toContain('perclos')
    expect(r.suggestions).toBe(1)
  })

  it('offers a break after three yawns in ten minutes', () => {
    let r = run(fresh(), 0, 10)
    for (let i = 0; i < 3; i++) {
      r = run(r.tracker, r.end, 2, { jawOpen: 0.8 })
      r = run(r.tracker, r.end, 60)
    }
    expect(r.tracker.yawns).toHaveLength(3)
    expect(r.tracker.reasons).toContain('yawns')
  })

  it('never offers a second break within 8 minutes', () => {
    let r = run(fresh(), 0, 60, { blink: 0.9 })
    expect(r.suggestions).toBe(1)
    let t = answerBreak(r.tracker, false)
    r = run(t, r.end, 5 * 60, { blink: 0.9 })
    expect(r.suggestions).toBe(0)
    r = run(r.tracker, r.end, 4 * 60, { blink: 0.9 })
    expect(r.suggestions).toBe(1)
    t = answerBreak(r.tracker, true)
    expect(t.aggregate.breaksAccepted).toBe(1)
    expect(t.aggregate.breaksDeclined).toBe(1)
  })

  it('lowers the sensitivity after two refusals', () => {
    const t = fresh()
    const twice = answerBreak(answerBreak(t, false), false)
    expect(twice.rules.perclosTired).toBeGreaterThan(t.rules.perclosTired)
  })

  it('explains every suggestion with its signals', () => {
    const r = run(fresh(), 0, 90, { blink: 0.9 })
    expect(r.tracker.reasons.length).toBeGreaterThan(0)
  })
})

describe('attention and aggregates', () => {
  it('computes attention as focused seconds over active seconds', () => {
    let r = run(fresh(), 0, 60)
    r = run(r.tracker, r.end, 60, { yaw: 60 })
    const a = r.tracker.aggregate
    expect(a.activeSeconds).toBeCloseTo(120, 0)
    expect(a.attention).toBeGreaterThan(0.5)
    expect(a.attention).toBeLessThan(0.6)
    expect(a.focusedSeconds + a.distractedSeconds + a.awaySeconds + a.tiredSeconds).toBeCloseTo(
      a.activeSeconds,
    )
  })

  it('keeps numbers only', () => {
    const r = run(fresh(), 0, 10)
    for (const v of Object.values(r.tracker.aggregate)) expect(typeof v).toBe('number')
  })

  it('makes the high setting more sensitive than the low one', () => {
    expect(rulesFor('high').minYaw).toBeLessThan(rulesFor('low').minYaw)
  })
})

describe('calibration', () => {
  it('learns the reading posture', () => {
    const samples = Array.from({ length: 120 }, (_, i) => ({
      ...reading,
      t: i / fps,
      yaw: 5 + (i % 2 ? 2 : -2),
      pitch: 30 + (i % 3) - 1,
    }))
    const c = calibrate('Desk', samples, 0)
    expect(c?.yawMean).toBeCloseTo(5)
    expect(c?.pitchMean).toBeCloseTo(30, 0)
    expect(c?.yawSd).toBeCloseTo(2)
  })

  it('needs enough frames with a face', () => {
    expect(calibrate('Desk', [{ ...reading, t: 0 }], 0)).toBeNull()
  })
})
