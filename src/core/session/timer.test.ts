import { describe, expect, it } from 'vitest'
import {
  activeMinutes,
  activeMs,
  applyAbsence,
  isFinished,
  isRunning,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
} from './timer'

const MIN = 60_000

describe('timestamp timer', () => {
  it('counts down from the start', () => {
    const t = startTimer(0, 30 * MIN)
    expect(remainingMs(t, 10 * MIN)).toBe(20 * MIN)
    expect(isRunning(t)).toBe(true)
  })

  it('resumes exactly after a reload: the state alone is enough', () => {
    const saved = JSON.parse(JSON.stringify(startTimer(1000, 30 * MIN)))
    expect(remainingMs(saved, 1000 + 12 * MIN)).toBe(18 * MIN)
  })

  it('stops counting while paused', () => {
    let t = startTimer(0, 30 * MIN)
    t = pauseTimer(t, 5 * MIN)
    expect(remainingMs(t, 50 * MIN)).toBe(25 * MIN)
    t = resumeTimer(t, 50 * MIN)
    expect(remainingMs(t, 55 * MIN)).toBe(20 * MIN)
    expect(t.pauses).toBe(1)
  })

  it('ignores a double pause or resume', () => {
    const t = pauseTimer(startTimer(0, MIN), 1000)
    expect(pauseTimer(t, 2000)).toBe(t)
    const r = resumeTimer(t, 3000)
    expect(resumeTimer(r, 4000)).toBe(r)
  })

  it('finishes and never goes past the total', () => {
    const t = startTimer(0, 30 * MIN)
    expect(isFinished(t, 31 * MIN)).toBe(true)
    expect(activeMs(t, 90 * MIN)).toBe(30 * MIN)
    expect(resumeTimer(pauseTimer(t, 31 * MIN), 40 * MIN).runningSince).toBeNull()
  })

  it('pauses itself 60 s after leaving the app', () => {
    const t = startTimer(0, 30 * MIN)
    const away = applyAbsence(t, 5 * MIN, 9 * MIN, 60_000)
    expect(away.paused).toBe(true)
    expect(remainingMs(away.timer, 9 * MIN)).toBe(24 * MIN)
  })

  it('keeps running after a short absence', () => {
    const t = startTimer(0, 30 * MIN)
    expect(applyAbsence(t, 5 * MIN, 5 * MIN + 30_000, 60_000).paused).toBe(false)
  })

  it('rounds active minutes', () => {
    expect(activeMinutes(startTimer(0, 30 * MIN), 12.6 * MIN)).toBe(13)
  })
})
