import { describe, expect, it } from 'vitest'
import { addDays } from '../calendar/dates'
import { defaultSettings } from '../model/defaults'
import type { Block, Chapter, Exercise, Session, SimLesson } from '../model/schemas'
import { dueReviews, pagesPerBlock, quizReady, readingRanges, reviewOffsets } from './content'
import {
  extraBlock,
  type PlannerInput,
  planWeek,
  projectWeeks,
  quickBlock,
  simUnlocked,
  spreadFirstKinds,
} from './week'

const monday = '2026-11-16'

function chapter(n: number, over: Partial<Chapter> = {}): Chapter {
  return {
    id: `cap-${n}`,
    order: n,
    title: `Chapter ${n}`,
    subject: n % 2 ? 'meteorology' : 'navigation',
    pageStart: n * 30,
    pageEnd: n * 30 + 23,
    difficulty: 2,
    pageReached: null,
    status: 'not-started',
    lastClarity: null,
    completedOn: null,
    ...over,
  }
}

const exercises: Exercise[] = [
  {
    id: 'es-regolo',
    kind: 'flight-computer',
    title: 'Flight computer',
    source: 'CRP-5',
    perWeek: 2,
    subject: 'navigation',
  },
  {
    id: 'es-meteo',
    kind: 'weather',
    title: 'METAR',
    source: 'LIMC',
    perWeek: 1,
    subject: 'meteorology',
  },
]

const simLessons: SimLesson[] = [
  {
    id: 'sim-01',
    order: 1,
    title: 'Circuit',
    objectives: [],
    tolerances: [],
    status: 'not-started',
    attempts: 0,
  },
]

const deskWeek = defaultSettings()
deskWeek.availability = [
  [{ window: 'evening', blocks: 1 }],
  [{ window: 'evening', blocks: 1 }],
  [{ window: 'evening', blocks: 1 }],
  [{ window: 'evening', blocks: 1 }],
  [{ window: 'evening', blocks: 1 }],
  [{ window: 'morning', blocks: 2 }],
  [{ window: 'morning', blocks: 1 }],
]

function session(over: Partial<Session> & Pick<Session, 'kind' | 'startedAt'>): Session {
  return {
    id: `s-${over.startedAt}`,
    blockId: null,
    mode: 'desk',
    subject: null,
    ref: null,
    content: '',
    endedAt: over.startedAt + 30 * 60_000,
    activeMinutes: 30,
    pauses: 0,
    leftApp: 0,
    clarity: null,
    pageReached: null,
    note: '',
    quizScore: null,
    simOutcome: null,
    simDeviations: '',
    exerciseClean: null,
    focus: null,
    ...over,
  }
}

const at = (date: string, hour = 20) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()

function input(over: Partial<PlannerInput> = {}): PlannerInput {
  return {
    today: monday,
    settings: deskWeek,
    chapters: [1, 2, 3, 4, 5, 6].map((n) => chapter(n)),
    exercises,
    simLessons,
    sessions: [],
    blocks: [],
    weeklyFactor: 1,
    ...over,
  }
}

describe('reading content', () => {
  it('scales pages by difficulty', () => {
    expect(pagesPerBlock(chapter(1, { difficulty: 1 }), 6, 30)).toBe(6)
    expect(pagesPerBlock(chapter(1, { difficulty: 3 }), 6, 30)).toBe(4)
  })

  it('gives consecutive ranges without crossing chapters or leaving < 2 pages', () => {
    const ranges = readingRanges([chapter(1), chapter(2)], 6, 30, 8)
    expect(ranges[0]).toMatchObject({ from: 30, to: 34 })
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]
      const cur = ranges[i]
      if (!prev || !cur) continue
      if (prev.chapter.id === cur.chapter.id) expect(cur.from).toBe(prev.to + 1)
      else expect(prev.to).toBe(prev.chapter.pageEnd)
      expect(cur.to).toBeLessThanOrEqual(cur.chapter.pageEnd)
    }
    for (const r of ranges)
      expect(r.chapter.pageEnd - r.to === 0 || r.chapter.pageEnd - r.to >= 2).toBe(true)
  })

  it('continues from the page reached', () => {
    const ranges = readingRanges([chapter(1, { pageReached: 40, status: 'in-progress' })], 6, 30, 1)
    expect(ranges[0]?.from).toBe(41)
  })
})

describe('spaced reviews (step 4)', () => {
  it('reviews a chapter rated 3 or less at +3, +7 and +21 days', () => {
    expect(reviewOffsets(2)).toEqual([3, 7, 21])
    const c = chapter(1, { status: 'done', completedOn: monday, lastClarity: 2, pageReached: 53 })
    const first = dueReviews([c], [])
    expect(first[0]?.due).toBe(addDays(monday, 3))
    const one = [
      session({
        kind: 'review',
        startedAt: at(addDays(monday, 3)),
        ref: { type: 'chapter', id: c.id },
      }),
    ]
    expect(dueReviews([c], one)[0]?.due).toBe(addDays(monday, 7))
    const two = [
      ...one,
      session({
        kind: 'review',
        startedAt: at(addDays(monday, 7)),
        ref: { type: 'chapter', id: c.id },
      }),
    ]
    expect(dueReviews([c], two)[0]?.due).toBe(addDays(monday, 21))
  })

  it('reviews a clear chapter once, at +14 days', () => {
    const c = chapter(1, { status: 'done', completedOn: monday, lastClarity: 5 })
    expect(dueReviews([c], [])[0]?.due).toBe(addDays(monday, 14))
    const done = [
      session({
        kind: 'review',
        startedAt: at(addDays(monday, 14)),
        ref: { type: 'chapter', id: c.id },
      }),
    ]
    expect(dueReviews([c], done)).toEqual([])
  })
})

describe('quizzes only after understanding (step 5)', () => {
  it('never offers a quiz before the chapter is read and rated at least 3', () => {
    const unread = chapter(1, { status: 'in-progress', pageReached: 40 })
    const unclear = chapter(2, { status: 'done', completedOn: monday, lastClarity: 2 })
    const ready = chapter(3, { status: 'done', completedOn: monday, lastClarity: 3 })
    expect(quizReady([unread, unclear, ready], []).map((c) => c.id)).toEqual(['cap-3'])
  })

  it('never puts a quiz in a plan for a chapter not yet read', () => {
    const plan = planWeek(input())
    expect(plan.blocks.filter((b) => b.kind === 'quiz')).toEqual([])
  })

  it('plans the quiz once the chapter is ready', () => {
    const chapters = [
      chapter(1, { status: 'done', completedOn: '2026-11-10', lastClarity: 4, pageReached: 53 }),
      chapter(2),
    ]
    const plan = planWeek(input({ chapters }))
    expect(plan.blocks.some((b) => b.kind === 'quiz' && b.ref?.id === 'cap-1')).toBe(true)
  })
})

describe('weekly load (steps 1–2)', () => {
  it('uses every available slot without a target date', () => {
    const plan = planWeek(input())
    expect(plan.blocks).toHaveLength(8)
    expect(plan.notes.some((n) => n.code === 'finish')).toBe(true)
  })

  it('splits about 60 / 25 / 15 between book, exercises and simulator', () => {
    const plan = planWeek(input())
    const count = (k: string) => plan.blocks.filter((b) => b.kind === k).length
    expect(count('simulator')).toBe(1)
    expect(count('exercise')).toBe(2)
    expect(count('reading')).toBe(5)
  })

  it('applies the weekly review factor', () => {
    expect(planWeek(input({ weeklyFactor: 0.85 })).blocks.length).toBe(7)
    expect(planWeek(input({ weeklyFactor: 1.1 })).blocks.length).toBe(9)
  })

  it('reads more when a target date needs it, and says if the date slips', () => {
    const tight = planWeek(input({ settings: { ...deskWeek, targetDate: addDays(monday, 21) } }))
    const loose = planWeek(input({ settings: { ...deskWeek, targetDate: addDays(monday, 400) } }))
    const reading = (p: typeof tight) => p.blocks.filter((b) => b.kind === 'reading').length
    expect(reading(tight)).toBeGreaterThan(reading(loose))
    expect(tight.notes.some((n) => n.code === 'target-late')).toBe(true)
    expect(loose.notes.some((n) => n.code === 'target-ok')).toBe(true)
  })

  it('puts only short phone blocks in commute slots (step 8)', () => {
    const settings = {
      ...deskWeek,
      availability: deskWeek.availability.map((d) => [
        { window: 'commute' as const, blocks: 1 },
        ...d,
      ]),
    }
    const chapters = [
      chapter(1, { status: 'done', completedOn: '2026-11-10', lastClarity: 2, pageReached: 53 }),
      chapter(2),
    ]
    const plan = planWeek(input({ settings, chapters }))
    const commute = plan.blocks.filter((b) => b.window === 'commute')
    expect(commute.length).toBe(7)
    for (const b of commute) {
      expect(['review', 'quiz', 'exercise']).toContain(b.kind)
      expect(b.mode).toBe('on-the-go')
      expect(b.minutes).toBeLessThanOrEqual(20)
    }
  })
})

describe('rescheduling (step 9)', () => {
  const lastWeek: Block[] = [0, 1, 2, 3, 4].map((i) => ({
    id: `old-${i}`,
    date: addDays(monday, -7 + i),
    order: 0,
    window: 'evening',
    minutes: 30,
    kind: 'reading',
    mode: 'desk',
    ref: null,
    pageFrom: null,
    pageTo: null,
    content: '',
    status: 'planned',
    why: { code: 'reading-next', chapter: 1, clarity: null, count: null },
    extra: false,
  }))

  it('moves skipped blocks forward but never grows the week by more than 20%', () => {
    const plan = planWeek(input({ blocks: lastWeek }))
    expect(plan.blocks.length).toBeLessThanOrEqual(Math.ceil(8 * 1.2))
    expect(plan.blocks.length).toBe(10)
    expect(plan.updates.filter((u) => u.status === 'moved')).toHaveLength(2)
    expect(plan.updates.filter((u) => u.status === 'skipped')).toHaveLength(3)
    expect(plan.notes).toContainEqual({ code: 'moved', count: 2 })
    expect(plan.notes).toContainEqual({ code: 'not-moved', count: 3 })
  })

  it('does not move the same block twice', () => {
    const moved = lastWeek.map((b) => ({ ...b, status: 'moved' as const }))
    expect(planWeek(input({ blocks: moved })).blocks).toHaveLength(8)
  })
})

describe('simulator as a reward (step 7)', () => {
  it('unlocks at the third theory block of the week', () => {
    const s = (d: number) => session({ kind: 'reading', startedAt: at(addDays(monday, d)) })
    expect(simUnlocked([s(0), s(1)], addDays(monday, 2), 3)).toBe(false)
    expect(simUnlocked([s(0), s(1), s(2)], addDays(monday, 2), 3)).toBe(true)
    expect(simUnlocked([s(-3), s(1), s(2)], addDays(monday, 2), 3)).toBe(false)
  })

  it('places the flight after at least 3 theory blocks', () => {
    const plan = planWeek(input())
    const index = plan.blocks.findIndex((b) => b.kind === 'simulator')
    expect(index).toBeGreaterThanOrEqual(3)
    expect(plan.blocks[index]?.mode).toBe('simulator')
  })
})

describe('variety (step 6)', () => {
  it('never opens three days in a row with the same kind', () => {
    const units = [0, 1, 2, 3].map((d) => ({
      date: addDays(monday, d),
      window: 'evening' as const,
    }))
    const out = spreadFirstKinds(units, ['reading', 'reading', 'reading', 'exercise'], [])
    expect(out.slice(0, 3)).not.toEqual(['reading', 'reading', 'reading'])
  })

  it('holds for a generated week', () => {
    const plan = planWeek(input())
    const firsts = [...new Set(plan.blocks.map((b) => b.date))].map(
      (d) => plan.blocks.find((b) => b.date === d && b.order === 0)?.kind,
    )
    for (let i = 2; i < firsts.length; i++)
      expect(firsts[i] === firsts[i - 1] && firsts[i] === firsts[i - 2]).toBe(false)
  })
})

describe('determinism and explanations (step 10)', () => {
  it('gives the same plan for the same input', () => {
    expect(planWeek(input())).toEqual(planWeek(input()))
  })

  it('explains every block', () => {
    for (const b of planWeek(input()).blocks) expect(b.why.code).toBeTruthy()
  })

  it('explains a review by the clarity that caused it', () => {
    const chapters = [
      chapter(1, {
        status: 'done',
        completedOn: addDays(monday, -3),
        lastClarity: 2,
        pageReached: 53,
      }),
      chapter(2),
    ]
    const review = planWeek(input({ chapters })).blocks.find((b) => b.kind === 'review')
    expect(review?.why).toMatchObject({ code: 'review', chapter: 1, clarity: 2, count: 1 })
  })

  it('plans only from today to Sunday', () => {
    const plan = planWeek(input({ today: addDays(monday, 4) }))
    for (const b of plan.blocks) expect(b.date >= addDays(monday, 4)).toBe(true)
  })
})

describe('short and extra blocks', () => {
  it('offers a 10-minute review of the latest chapter', () => {
    const q = quickBlock(
      input({ chapters: [chapter(1, { pageReached: 40, status: 'in-progress' })] }),
    )
    expect(q).toMatchObject({ kind: 'review', minutes: 10, extra: true })
  })

  it('offers an exercise when nothing is read yet', () => {
    expect(quickBlock(input())?.kind).toBe('exercise')
  })

  it('offers the next pages on a free day', () => {
    expect(extraBlock(input())).toMatchObject({ kind: 'reading', pageFrom: 30 })
  })

  it('projects chapters over the next weeks', () => {
    const weeks = projectWeeks(input(), 4)
    expect(weeks).toHaveLength(4)
    expect(weeks[0]?.chapters[0]).toBe('cap-1')
  })
})
