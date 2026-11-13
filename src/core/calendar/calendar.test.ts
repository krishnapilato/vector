import { describe, expect, it } from 'vitest'
import type { Block } from '../model/schemas'
import {
  addDays,
  addMonths,
  daysBetween,
  isWeekend,
  mondayOf,
  monthStart,
  weekDates,
  weekday,
} from './dates'
import { toIcs } from './ics'

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('ignores daylight saving changes', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })

  it('starts weeks on Monday', () => {
    expect(weekday('2026-11-16')).toBe(0)
    expect(weekday('2026-11-22')).toBe(6)
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
    expect(mondayOf('2026-11-16')).toBe('2026-11-16')
    expect(weekDates('2026-11-16')).toHaveLength(7)
    expect(isWeekend('2026-11-21')).toBe(true)
    expect(isWeekend('2026-11-20')).toBe(false)
  })

  it('moves by months', () => {
    expect(monthStart('2026-11-13')).toBe('2026-11-01')
    expect(addMonths('2026-11-13', 2)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01')
  })
})

describe('ics export', () => {
  const block: Block = {
    id: 'b1',
    date: '2026-11-13',
    order: 0,
    window: 'evening',
    minutes: 30,
    kind: 'reading',
    mode: 'desk',
    ref: { type: 'chapter', id: 'cap-04' },
    pageFrom: 112,
    pageTo: 124,
    content: 'p. 112–124',
    status: 'planned',
    why: { code: 'reading-next', chapter: 4, clarity: null, count: null },
    extra: false,
  }

  it('writes one event per block with floating local times', () => {
    const ics = toIcs(
      [
        { block, title: 'Reading, Trebbi ch. 4', description: 'p. 112–124' },
        { block: { ...block, id: 'b2' }, title: 'Review; ch. 3', description: 'quick' },
      ],
      Date.UTC(2026, 10, 13),
    )
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261113T210000')
    expect(ics).toContain('DTEND:20261113T213000')
    expect(ics).toContain('DTSTART:20261113T214000')
    expect(ics).toContain('SUMMARY:Reading\\, Trebbi ch. 4')
    expect(ics).toContain('SUMMARY:Review\\; ch. 3')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('folds long lines at 75 octets', () => {
    const ics = toIcs([{ block, title: 'x'.repeat(200), description: '' }], 0)
    for (const line of ics.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})
