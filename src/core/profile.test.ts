import { describe, expect, it } from 'vitest'
import { pplSample } from './content/ppl-sample'
import { buildProfile, dayPart, profileHints } from './profile'

const concept = pplSample.concepts[0] as (typeof pplSample.concepts)[number]
const variant = concept.variants[0] as (typeof concept.variants)[number]

const attempt = (verdict: string, i: number, extra = {}) => ({
  at: new Date(2026, 9, 1, 9, i).toISOString(),
  conceptId: concept.id,
  variantId: variant.id,
  verdict,
  elapsedSeconds: 10 + i,
  seenBefore: i % 2 === 0,
  ...extra,
})

describe('buildProfile', () => {
  it('summarizes attempts by subject, kind and part of day', () => {
    const attempts = [
      ...Array.from({ length: 8 }, (_, i) => attempt('solid', i)),
      attempt('wrong', 8),
      attempt('recognized', 10),
      attempt('guessed', 11),
    ]
    const p = buildProfile(attempts, [], [{ term: 'stall', count: 3 }], pplSample)
    expect(p.attempts).toBe(11)
    expect(p.understood).toBeCloseTo(8 / 11)
    expect(p.subjects[0]?.subjectId).toBe(concept.subjectId)
    expect(p.kinds[0]?.kind).toBe(variant.kind)
    expect(p.hardest[0]).toMatchObject({ conceptId: concept.id, misses: 1 })
    expect(p.dayParts).toEqual([{ part: 'morning', attempts: 11, understood: 8 / 11 }])
    expect(p.recognized).toBeGreaterThan(0)
    expect(p.lucky).toBeCloseTo(1 / 11)
    expect(p.medianSeconds).toBe(15)
    expect(p.topLookups).toEqual([{ term: 'stall', count: 3 }])
    expect(p.focus.score).toBeNull()
  })

  it('combines focus sessions', () => {
    const p = buildProfile(
      [],
      [
        { endedAt: '2026-10-02', seconds: 100, attentiveSeconds: 50, phoneSeen: 1, leftApp: 0 },
        { endedAt: '2026-10-01', seconds: 100, attentiveSeconds: 100, phoneSeen: 0, leftApp: 0 },
      ],
      [],
      pplSample,
    )
    expect(p.focus).toEqual({ sessions: 2, score: 0.75, recentScores: [1, 0.5], phoneSessions: 1 })
    expect(p.medianSeconds).toBe(0)
  })
})

describe('profileHints', () => {
  it('stays silent with little data', () => {
    expect(profileHints(buildProfile([attempt('wrong', 1)], [], [], pplSample))).toEqual([])
  })

  it('describes study patterns', () => {
    const attempts = Array.from({ length: 30 }, (_, i) =>
      attempt(i % 3 ? 'recognized' : 'guessed', i),
    )
    const hints = profileHints(buildProfile(attempts, [], [], pplSample))
    expect(hints.some((h) => h.includes('riconoscere'))).toBe(true)
    expect(hints.some((h) => h.includes('indovina'))).toBe(true)
    expect(hints.some((h) => h.includes('materia più difficile'))).toBe(true)
  })
})

describe('dayPart', () => {
  it('splits the day', () => {
    expect(dayPart(new Date(2026, 0, 1, 8))).toBe('morning')
    expect(dayPart(new Date(2026, 0, 1, 13))).toBe('afternoon')
    expect(dayPart(new Date(2026, 0, 1, 20))).toBe('evening')
    expect(dayPart(new Date(2026, 0, 1, 2))).toBe('night')
  })
})
