import { describe, expect, it } from 'vitest'
import { pplSample } from './content/ppl-sample'
import { buildDiary } from './diary'
import {
  buildOpenPrompt,
  gradeOpen,
  keyPointsFor,
  mergeCovered,
  openPrompt,
  parseOpenFeedback,
  pickOpenConcept,
} from './open'
import { createRng } from './random'
import { coverage, matchesTopic, syllabus } from './syllabus'

describe('open questions', () => {
  it('uses written key points, or the sentences of the source', () => {
    expect(keyPointsFor({ source: 'x', keyPoints: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(
      keyPointsFor({
        source:
          'La portanza è perpendicolare al vento relativo. Lo stallo avviene oltre l’angolo critico. Ok.',
      }),
    ).toEqual([
      'La portanza è perpendicolare al vento relativo.',
      'Lo stallo avviene oltre l’angolo critico.',
    ])
  })

  it('asks in different words', () => {
    const rng = createRng(1)
    const asked = new Set(Array.from({ length: 30 }, () => openPrompt('Lo stallo.', rng)))
    expect(asked.size).toBeGreaterThan(1)
    for (const p of asked) expect(p).toContain('Lo stallo')
  })

  it('builds a grounded correction prompt', () => {
    const p = buildOpenPrompt({
      title: 'Stallo',
      source: 'S',
      keyPoints: ['a', 'b'],
      answer: 'boh',
      round: 2,
    })
    expect(p).toContain('1. a')
    expect(p).toContain('2. b')
    expect(p).toContain('secondo tentativo')
    expect(p).toContain('SENZA dare la risposta')
  })

  it('parses the correction strictly', () => {
    expect(
      parseOpenFeedback(
        '```json\n{"covered":[true,false],"mistakes":["x",""],"hint":"Perché?"}\n```',
        2,
      ),
    ).toEqual({
      covered: [true, false],
      mistakes: ['x'],
      hint: 'Perché?',
    })
    expect(parseOpenFeedback('{"covered":[true,true],"hint":"inutile"}', 2).hint).toBeNull()
    expect(() => parseOpenFeedback('{"covered":[true]}', 2)).toThrow()
  })

  it('grades: first try, after a hint, incomplete', () => {
    expect(
      mergeCovered([
        [true, false],
        [false, true],
      ]),
    ).toEqual([true, true])
    expect(gradeOpen([[true, true]], 0).verdict).toBe('solid')
    expect(
      gradeOpen(
        [
          [true, false],
          [false, true],
        ],
        0,
      ).verdict,
    ).toBe('shaky')
    expect(gradeOpen([[true, false]], 0).verdict).toBe('wrong')
    expect(gradeOpen([[true, true]], 1).verdict).toBe('wrong')
    expect(gradeOpen([], 0).counts).toBe(false)
  })

  it('picks weighted concepts, not the last one', () => {
    const rng = createRng(3)
    const cs = pplSample.concepts
    const first = cs[0]?.id ?? null
    for (let i = 0; i < 20; i++)
      expect(pickOpenConcept(cs, () => 1, first, rng)?.id).not.toBe(first)
    expect(pickOpenConcept([], () => 1, null, rng)).toBeNull()
  })
})

describe('syllabus', () => {
  it('covers every EASA subject', () => {
    for (const s of ['law', 'hpl', 'met', 'com', 'pof', 'ops', 'fpp', 'agk', 'nav'])
      expect(syllabus[s]?.length).toBeGreaterThan(3)
  })

  it('matches topics by keyword, accent-insensitive', () => {
    const stall = syllabus.pof?.find((t) => t.id === 'pof-stall')
    if (!stall) throw new Error('missing')
    expect(matchesTopic('Lo STALLO dinamico', stall)).toBe(true)
    expect(matchesTopic('Il vento', stall)).toBe(false)
  })

  it('computes coverage from concepts and book chapters', () => {
    const cov = coverage(
      'pof',
      [
        { id: 'a', subjectId: 'pof', title: 'Stallo', source: '' },
        { id: 'b', subjectId: 'pof', title: 'Vite', source: '' },
        { id: 'c', subjectId: 'met', title: 'Stallo', source: '' },
      ],
      (id) => id === 'a',
      [
        {
          id: 'k',
          title: 'PHAK',
          subjectId: null,
          chapters: [{ title: 'Chapter 5 Stall and spin', startPage: 40 }],
        },
      ],
    )
    const stall = cov.find((c) => c.topic.id === 'pof-stall')
    expect(stall?.concepts).toEqual(['a', 'b'])
    expect(stall?.known).toBe(0.5)
    expect(stall?.chapters[0]).toMatchObject({ bookId: 'k', page: 40 })
    expect(cov.find((c) => c.topic.id === 'pof-propeller')?.known).toBe(0)
    expect(coverage('xx', [], () => false, [])).toEqual([])
  })
})

describe('error diary', () => {
  const a = (conceptId: string, verdict: string, min: number) => ({
    at: `2026-10-01T10:${String(min).padStart(2, '0')}:00Z`,
    conceptId,
    variantId: 'v',
    verdict,
    elapsedSeconds: 5,
    seenBefore: false,
    prompt: 'P',
    chosen: null,
    correct: 'C',
  })
  const c1 = pplSample.concepts[0]
  const c2 = pplSample.concepts[1]

  it('groups mistakes and knows which are fixed', () => {
    if (!c1 || !c2) throw new Error('sample')
    const d = buildDiary(
      [
        a(c1.id, 'wrong', 1),
        a(c1.id, 'solid', 2),
        a(c2.id, 'solid', 3),
        a(c2.id, 'guessed', 4),
        a('gone', 'unknown', 5),
      ],
      pplSample.concepts,
    )
    expect(d.map((e) => [e.conceptId, e.fixed])).toEqual([
      ['gone', false],
      [c2.id, false],
      [c1.id, true],
    ])
    expect(d[0]?.title).toBe('Concetto rimosso')
    expect(d[2]?.mistakes).toHaveLength(1)
  })
})
