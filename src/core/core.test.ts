import { beforeAll, describe, expect, it } from 'vitest'
import { defaultConfig } from '../config/config'
import { pplSample } from './content/ppl-sample'
import { buildQuestion, minReadSeconds } from './content/question'
import { isGenerated } from './content/types'
import { grade } from './grading'
import { applyAnswer, type ConceptProgress, flagVariant, masteryOf, scores } from './progress'
import { createRng, randomInt, shuffle } from './random'
import { createSrs, type Srs } from './scheduler'
import {
  addInterruption,
  advance,
  buildSession,
  currentItem,
  defaultSettings,
  isFinished,
  nextDue,
  pickVariant,
  recordResult,
  summarize,
} from './session'

const now = new Date('2026-11-01T10:00:00Z')
const settings = defaultSettings(defaultConfig)
let srs: Srs

beforeAll(async () => {
  srs = await createSrs()
})

describe('random', () => {
  it('is deterministic for a seed', () => {
    expect(shuffle(createRng(1), [1, 2, 3, 4, 5])).toEqual(shuffle(createRng(1), [1, 2, 3, 4, 5]))
  })
  it('keeps integers in range', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const v = randomInt(rng, 3, 5)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(5)
    }
  })
})

describe('sample course', () => {
  it('builds every variant many times with 4 distinct options and one correct answer', () => {
    const rng = createRng(42)
    for (const concept of pplSample.concepts) {
      expect(pplSample.subjects.some((s) => s.id === concept.subjectId)).toBe(true)
      for (const variant of concept.variants) {
        for (let i = 0; i < 50; i++) {
          const q = buildQuestion(concept, variant, rng, true)
          expect(q.options).toHaveLength(4)
          expect(new Set(q.options.map((o) => o.text)).size).toBe(4)
          expect(q.options.some((o) => o.id === q.correctOptionId)).toBe(true)
          if (concept.why) expect(q.why?.options).toHaveLength(3)
        }
      }
    }
  })

  it('computes turn stall speed correctly', () => {
    const concept = pplSample.concepts.find((c) => c.id === 'stallo-in-virata')
    const calc = concept?.variants.find(isGenerated)
    if (!concept || !calc) throw new Error('missing generator')
    for (let seed = 0; seed < 30; seed++) {
      const q = calc.generate(createRng(seed))
      const vs = Number(/è (\d+) kt/.exec(q.prompt)?.[1])
      const bank = Number(/a (\d+)° di/.exec(q.prompt)?.[1])
      const expected = Math.round(vs * Math.sqrt(1 / Math.cos((bank * Math.PI) / 180)))
      expect(q.answer).toBe(`${expected} kt`)
    }
  })

  it('never shows the same numbers twice in a row for generated questions', () => {
    const concept = pplSample.concepts.find((c) => c.id === 'distanze-dichiarate')
    const calc = concept?.variants.find(isGenerated)
    if (!calc) throw new Error('missing generator')
    const rng = createRng(3)
    const prompts = new Set(Array.from({ length: 20 }, () => calc.generate(rng).prompt))
    expect(prompts.size).toBeGreaterThan(10)
  })

  it('requires minimum reading time', () => {
    expect(minReadSeconds({ prompt: 'Breve', options: [] })).toBe(1.5)
    expect(minReadSeconds({ prompt: 'a '.repeat(40), options: [] })).toBeGreaterThan(5)
  })
})

describe('grade', () => {
  const base = {
    correct: true,
    confidence: 'sure' as const,
    whyCorrect: null,
    elapsedSeconds: 10,
    minReadSeconds: 3,
    seenBefore: false,
  }
  it('counts only real understanding', () => {
    expect(grade(base)).toEqual({ verdict: 'solid', rating: 3, counts: true })
    expect(grade({ ...base, confidence: 'unsure' }).verdict).toBe('shaky')
    expect(grade({ ...base, confidence: 'guess' })).toMatchObject({
      verdict: 'guessed',
      counts: false,
    })
    expect(grade({ ...base, whyCorrect: false })).toMatchObject({
      verdict: 'reason-wrong',
      counts: false,
    })
    expect(grade({ ...base, correct: false })).toMatchObject({ verdict: 'wrong', rating: 1 })
    expect(grade({ ...base, correct: null })).toMatchObject({ verdict: 'unknown', rating: 1 })
  })
  it('flags a fast answer on a seen wording as recognition', () => {
    expect(grade({ ...base, seenBefore: true, elapsedSeconds: 1 })).toMatchObject({
      verdict: 'recognized',
      rating: 2,
    })
    expect(grade({ ...base, seenBefore: false, elapsedSeconds: 1 }).verdict).toBe('solid')
  })
})

describe('progress', () => {
  const answer = (verdict: 'solid' | 'wrong', seenBefore = false) => ({
    variantId: 'definizione',
    generated: false,
    seenBefore,
    graded:
      verdict === 'solid'
        ? ({ verdict, rating: 3, counts: true } as const)
        : ({ verdict, rating: 1, counts: false } as const),
    updatesSchedule: true,
  })

  it('schedules, counts wordings and separates first exposure from repeats', () => {
    const p1 = applyAnswer(undefined, 'c', answer('solid'), srs, now)
    expect(p1.card?.reps).toBe(1)
    expect(p1.variants.definizione).toEqual({ seen: 1, correct: 1 })
    const p2 = applyAnswer(p1, 'c', answer('wrong', true), srs, now)
    expect(p2.firstExposure).toEqual({ n: 1, correct: 1 })
    expect(p2.repeat).toEqual({ n: 1, correct: 0 })
    expect(scores([p2])).toEqual({ comprehension: 1, recognition: 0, answered: 2 })
  })

  it('does not move the schedule on a retry, nor track generated wordings', () => {
    const p = applyAnswer(
      undefined,
      'c',
      { ...answer('solid'), generated: true, updatesSchedule: false },
      srs,
      now,
    )
    expect(p.card).toBeNull()
    expect(p.variants).toEqual({})
  })

  it('reports mastery', () => {
    expect(masteryOf(undefined, now)).toBe('new')
    const p = applyAnswer(undefined, 'c', answer('solid'), srs, now)
    expect(masteryOf(p, now)).toBe('learning')
    expect(masteryOf(p, new Date('2027-01-01'))).toBe('due')
    const solid: ConceptProgress = { ...p, card: p.card && { ...p.card, state: 2, stability: 30 } }
    expect(masteryOf(solid, now)).toBe('consolidated')
    expect(scores([])).toEqual({ comprehension: null, recognition: null, answered: 0 })
  })

  it('flags a wording once', () => {
    const p = flagVariant(flagVariant(undefined, 'c', 'v1'), 'c', 'v1')
    expect(p.flagged).toEqual(['v1'])
  })
})

describe('session', () => {
  const opts = (progress = new Map<string, ConceptProgress>()) => ({
    course: pplSample,
    progress,
    settings,
    config: defaultConfig,
    rng: createRng(5),
    now,
    id: 's1',
  })

  it('starts with a few new concepts when nothing has been studied', () => {
    const s = buildSession(opts())
    expect(s?.items).toHaveLength(settings.newConcepts)
    expect(s?.items.every((i) => !i.seenBefore)).toBe(true)
  })

  it('filters by subject', () => {
    const s = buildSession({ ...opts(), subjectId: 'met' })
    expect(s?.items.every((i) => i.question.conceptId !== 'angolo-di-attacco')).toBe(true)
  })

  it('returns null when all is caught up, unless studying early', () => {
    const progress = new Map<string, ConceptProgress>()
    for (const c of pplSample.concepts) {
      progress.set(
        c.id,
        applyAnswer(
          undefined,
          c.id,
          {
            variantId: 'x',
            generated: true,
            seenBefore: false,
            graded: { verdict: 'solid', rating: 3, counts: true },
            updatesSchedule: true,
          },
          srs,
          now,
        ),
      )
    }
    expect(buildSession(opts(progress))).toBeNull()
    expect(buildSession({ ...opts(progress), early: true })?.items.length).toBeGreaterThan(0)
    expect(nextDue(pplSample, progress)?.getTime()).toBeGreaterThan(now.getTime())
    expect(nextDue(pplSample, new Map())).toBeNull()
  })

  it('prefers unseen wordings and skips reported ones', () => {
    const concept = pplSample.concepts.find((c) => c.id === 'composizione-aria')
    if (!concept) throw new Error('missing')
    const p: ConceptProgress = {
      ...flagVariant(undefined, concept.id, 'ossigeno'),
      variants: { 'piu-abbondante': { seen: 3, correct: 3 } },
    }
    const progress = new Map([[concept.id, p]])
    // Only one usable wording left: the seen one, never the reported one.
    for (let i = 0; i < 10; i++) {
      expect(pickVariant(concept, progress, createRng(i)).id).toBe('piu-abbondante')
    }
    expect(pickVariant(concept, new Map(), createRng(1), 'ossigeno').id).toBe('piu-abbondante')
  })

  it('brings a missed concept back later with a different wording', () => {
    const s = buildSession(opts())
    if (!s) throw new Error('no session')
    const first = currentItem(s)
    const result = {
      chosenOptionId: null,
      confidence: null,
      whyOptionId: null,
      elapsedSeconds: 2,
      verdict: 'unknown' as const,
    }
    const r = recordResult(s, result, false, {
      course: pplSample,
      progress: new Map(),
      rng: createRng(9),
      config: defaultConfig,
    })
    expect(r.items).toHaveLength(s.items.length + 1)
    const retry = r.items.find((i) => i.attempt === 2)
    expect(retry?.question.conceptId).toBe(first?.question.conceptId)
    // Recording twice changes nothing.
    expect(
      recordResult(r, result, false, {
        course: pplSample,
        progress: new Map(),
        rng: createRng(9),
        config: defaultConfig,
      }),
    ).toBe(r)

    let done = addInterruption(r)
    while (!isFinished(done)) done = advance(done)
    expect(currentItem(done)).toBeNull()
    expect(summarize(done, pplSample)).toMatchObject({ total: 1, known: 0, interruptions: 1 })
    expect(summarize(done, pplSample).toReview).toHaveLength(1)
  })
})
