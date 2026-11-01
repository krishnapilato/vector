import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../config/config'
import { formatSeconds, outcomeAfter, remainingFraction, timeLimitFor } from './question-timer'

describe('timeLimitFor', () => {
  it('uses the per-kind timer in practice mode', () => {
    expect(timeLimitFor('recall', defaultConfig)).toBe(30)
    expect(timeLimitFor('calculation', defaultConfig, 'practice')).toBe(150)
  })

  it('has no per-question timer when understanding or in an exam simulation', () => {
    expect(timeLimitFor('recall', defaultConfig, 'understand')).toBeNull()
    expect(timeLimitFor('recall', defaultConfig, 'exam')).toBeNull()
  })
})

describe('outcomeAfter', () => {
  it('turns a timeout into "unknown", not a wrong answer', () => {
    expect(outcomeAfter(30, 30)).toBe('unknown')
    expect(outcomeAfter(12, 30)).toBe('answered')
  })

  it('never times out without a limit', () => {
    expect(outcomeAfter(9999, null)).toBe('answered')
  })
})

describe('remainingFraction', () => {
  it('stays within 0..1', () => {
    expect(remainingFraction(0, 30)).toBe(1)
    expect(remainingFraction(15, 30)).toBe(0.5)
    expect(remainingFraction(45, 30)).toBe(0)
    expect(remainingFraction(5, null)).toBe(1)
  })
})

describe('formatSeconds', () => {
  it('formats short and long durations', () => {
    expect(formatSeconds(30)).toBe('30 s')
    expect(formatSeconds(150)).toBe('2:30')
    expect(formatSeconds(null)).toBe('nessuno')
  })
})
