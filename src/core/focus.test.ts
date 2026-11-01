import { describe, expect, it } from 'vitest'
import {
  classify,
  type FocusSample,
  focusScore,
  headAngles,
  isMouthMoving,
  startFocus,
  startVoice,
  step,
  stepVoice,
  summarize,
  visibleDistraction,
} from './focus/focus'

const base: FocusSample = {
  t: 0,
  hidden: false,
  face: true,
  lookingAway: false,
  eyesClosed: false,
  phone: false,
  voice: false,
  mouthMoving: false,
}
const rules = { ignoreSeconds: 3, pauseAfterSeconds: 10, aloud: false }

function run(samples: Partial<FocusSample>[], r = rules) {
  let s = startFocus(0)
  for (const [i, x] of samples.entries()) s = step(s, { ...base, t: i + 1, ...x }, r)
  return s
}

describe('classify', () => {
  it('orders conditions by seriousness', () => {
    expect(classify({ ...base, hidden: true, phone: true }, rules)).toBe('left')
    expect(classify({ ...base, face: false }, rules)).toBe('away')
    expect(classify({ ...base, phone: true, lookingAway: true }, rules)).toBe('phone')
    expect(classify({ ...base, eyesClosed: true }, rules)).toBe('drowsy')
    expect(classify({ ...base, lookingAway: true }, rules)).toBe('lookAway')
    expect(classify(base, rules)).toBeNull()
  })

  it('tells the learner’s own voice from voices nearby', () => {
    expect(classify({ ...base, voice: true, mouthMoving: true }, rules)).toBe('talking')
    expect(classify({ ...base, voice: true, mouthMoving: true }, { aloud: true })).toBeNull()
    expect(classify({ ...base, voice: true }, rules)).toBe('voices')
  })

  it('works with sensors off', () => {
    expect(classify({ ...base, face: null, voice: null }, rules)).toBeNull()
  })
})

describe('step', () => {
  it('forgives short distractions', () => {
    const s = run([{}, { phone: true }, { phone: true }, {}, {}])
    expect(s.counts.phone).toBe(0)
    expect(s.attentiveSeconds).toBe(5)
    expect(focusScore(s)).toBe(1)
  })

  it('counts a long distraction once and asks to pause', () => {
    const away = Array.from({ length: 12 }, () => ({ face: false }))
    const s = run([{}, ...away])
    expect(s.counts.away).toBe(1)
    expect(s.shouldPause).toBe(true)
    expect(visibleDistraction(s, rules)).toBe('away')
    expect(focusScore(s)).toBeLessThan(0.5)
    const back = step(s, { ...base, t: 20 }, rules)
    expect(back.shouldPause).toBe(false)
    expect(visibleDistraction(back, rules)).toBeNull()
  })

  it('never pauses for looking away, only counts it', () => {
    const s = run(Array.from({ length: 15 }, () => ({ lookingAway: true })))
    expect(s.shouldPause).toBe(false)
    expect(s.counts.lookAway).toBe(1)
  })

  it('caps long gaps between samples', () => {
    let s = startFocus(0)
    s = step(s, { ...base, t: 1000 }, rules)
    expect(s.seconds).toBe(5)
  })

  it('summarizes into numbers only', () => {
    const s = run([
      ...Array.from({ length: 4 }, () => ({ hidden: true })),
      {},
      ...Array.from({ length: 4 }, () => ({ voice: true })),
    ])
    expect(summarize(s)).toMatchObject({ leftApp: 1, talking: 1, seconds: 9 })
  })
})

describe('signals', () => {
  it('reads head angles from the transformation matrix', () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    expect(headAngles(identity)).toEqual({ yaw: 0, pitch: -0 })
    const a = (40 * Math.PI) / 180
    const turned = [
      Math.cos(a),
      0,
      -Math.sin(a),
      0,
      0,
      1,
      0,
      0,
      Math.sin(a),
      0,
      Math.cos(a),
      0,
      0,
      0,
      0,
      1,
    ]
    expect(headAngles(turned).yaw).toBeCloseTo(40)
  })

  it('detects mouth movement, not an open mouth', () => {
    expect(isMouthMoving([0.5, 0.5, 0.5, 0.5, 0.5])).toBe(false)
    expect(isMouthMoving([0.1, 0.4, 0.05, 0.35, 0.1])).toBe(true)
    expect(isMouthMoving([0.1, 0.4])).toBe(false)
  })

  it('detects a voice above an adapting noise floor', () => {
    let v = startVoice()
    for (let i = 0; i < 50; i++) v = stepVoice(v, 0.005, 0.1)
    expect(v.active).toBe(false)
    v = stepVoice(v, 0.2, 0.1)
    expect(v.active).toBe(true)
    v = stepVoice(v, 0.005, 0.1)
    expect(v.active).toBe(true) // held between words
    for (let i = 0; i < 6; i++) v = stepVoice(v, 0.005, 0.1)
    expect(v.active).toBe(false)
    // A constantly noisy room raises the floor.
    for (let i = 0; i < 4000; i++) v = stepVoice(v, 0.05, 0.1)
    expect(v.floor).toBeGreaterThan(0.02)
  })
})
