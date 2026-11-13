import { describe, expect, it } from 'vitest'
import { formatClock } from './clock'

describe('formatClock', () => {
  it('shows minutes and padded seconds', () => {
    expect(formatClock(30 * 60_000)).toBe('30:00')
    expect(formatClock(65_000)).toBe('1:05')
  })

  it('shows hours for long Open sessions', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })

  it('rounds up so time left is never shown as zero, and never goes below zero', () => {
    expect(formatClock(1)).toBe('0:01')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-5000)).toBe('0:00')
  })
})
