import { describe, expect, it } from 'vitest'
import { elapsedShare, formatClock } from './clock'

describe('formatClock', () => {
  it('shows minutes and padded seconds', () => {
    expect(formatClock(30 * 60_000)).toBe('30:00')
    expect(formatClock(65_000)).toBe('1:05')
  })

  it('rounds up so time left is never shown as zero', () => {
    expect(formatClock(1)).toBe('0:01')
    expect(formatClock(59_001)).toBe('1:00')
  })

  it('never goes below zero', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-5000)).toBe('0:00')
  })
})

describe('elapsedShare', () => {
  it('goes from 0 to 1 over the block', () => {
    expect(elapsedShare(30, 30)).toBe(0)
    expect(elapsedShare(15, 30)).toBe(0.5)
    expect(elapsedShare(0, 30)).toBe(1)
  })

  it('stays within bounds', () => {
    expect(elapsedShare(40, 30)).toBe(0)
    expect(elapsedShare(-1, 30)).toBe(1)
    expect(elapsedShare(10, 0)).toBe(1)
  })
})
