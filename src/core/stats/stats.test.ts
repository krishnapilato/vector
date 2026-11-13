import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from '../backup/csv'
import { mergeSnapshots } from '../backup/merge'
import { evaluateMilestones } from '../milestones/milestones'
import { defaultSettings } from '../model/defaults'
import type { Chapter, Exercise, Session, SimLesson, Snapshot } from '../model/schemas'
import { bestHours, clarityBySubject, quizByChapter, reviewDue, totals, weekSummary } from './stats'

const at = (date: string, hour = 20) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()

function session(over: Partial<Session> & Pick<Session, 'id' | 'startedAt'>): Session {
  return {
    blockId: null,
    kind: 'reading',
    mode: 'desk',
    subject: 'meteorology',
    ref: { type: 'chapter', id: 'cap-1' },
    content: '',
    endedAt: over.startedAt + 30 * 60_000,
    activeMinutes: 30,
    pauses: 0,
    leftApp: 0,
    clarity: 4,
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

const chapter = (over: Partial<Chapter> = {}): Chapter => ({
  id: 'cap-1',
  order: 1,
  title: 'Atmosfera',
  subject: 'meteorology',
  pageStart: 10,
  pageEnd: 29,
  difficulty: 2,
  pageReached: null,
  status: 'not-started',
  lastClarity: null,
  completedOn: null,
  ...over,
})

const focus = (attention: number) => ({
  activeSeconds: 1800,
  focusedSeconds: 1800 * attention,
  distractedSeconds: 1800 * (1 - attention),
  awaySeconds: 0,
  tiredSeconds: 0,
  distractions: 1,
  breaksSuggested: 0,
  breaksAccepted: 0,
  breaksDeclined: 0,
  attention,
  fatigueAvg: 0,
  fatigueMax: 0,
})

describe('logbook totals', () => {
  it('adds study hours by period and keeps the simulator apart', () => {
    const sessions = [
      session({ id: 'a', startedAt: at('2026-10-20') }),
      session({ id: 'b', startedAt: at('2026-11-03') }),
      session({ id: 'c', startedAt: at('2026-11-17'), activeMinutes: 60 }),
      session({ id: 'd', startedAt: at('2026-11-18'), kind: 'simulator', activeMinutes: 45 }),
    ]
    const t = totals(sessions, [chapter({ pageReached: 19, status: 'in-progress' })], '2026-11-18')
    expect(t.hoursTotal).toBe(2)
    expect(t.hoursMonth).toBe(1.5)
    expect(t.hoursWeek).toBe(1)
    expect(t.simHours).toBe(0.8)
    expect(t.bookPercent).toBe(50)
  })

  it('finds the best part of the day by attention', () => {
    const best = bestHours([
      session({ id: 'a', startedAt: at('2026-11-17', 9), focus: focus(0.9) }),
      session({ id: 'b', startedAt: at('2026-11-17', 21), focus: focus(0.6) }),
      session({ id: 'c', startedAt: at('2026-11-18', 21) }),
    ])
    expect(best).toEqual([
      { part: 'morning', attention: 90, sessions: 1 },
      { part: 'evening', attention: 60, sessions: 1 },
    ])
  })

  it('tracks clarity per subject and quiz scores per chapter', () => {
    const sessions = [
      session({ id: 'a', startedAt: 1, clarity: 2 }),
      session({ id: 'b', startedAt: 2, clarity: 4 }),
      session({ id: 'q', startedAt: 3, kind: 'quiz', quizScore: { correct: 18, total: 20 } }),
    ]
    expect(clarityBySubject(sessions)[0]).toMatchObject({
      subject: 'meteorology',
      ratings: [2, 4, 4],
    })
    expect(quizByChapter(sessions)).toEqual([{ chapterId: 'cap-1', scores: [90] }])
  })
})

describe('weekly review', () => {
  it('summarises the week', () => {
    const sessions = [
      session({ id: 'a', startedAt: at('2026-11-16'), pageReached: 15 }),
      session({ id: 'b', startedAt: at('2026-11-17'), pageReached: 21, focus: focus(0.9) }),
      session({ id: 'old', startedAt: at('2026-11-10'), pageReached: 12 }),
    ]
    const w = weekSummary(sessions, [chapter()], '2026-11-16')
    expect(w.blocksDone).toBe(2)
    expect(w.activeHours).toBe(1)
    expect(w.pagesRead).toBe(9)
    expect(w.best?.id).toBe('b')
  })

  it('is offered on Sunday and on Monday, once per week', () => {
    expect(reviewDue('2026-11-22', [])).toBe('2026-11-16')
    expect(reviewDue('2026-11-23', [])).toBe('2026-11-16')
    expect(reviewDue('2026-11-23', ['2026-11-16'])).toBeNull()
    expect(reviewDue('2026-11-18', [])).toBeNull()
  })
})

describe('milestones', () => {
  const exercises: Exercise[] = [
    {
      id: 'es-regolo',
      kind: 'flight-computer',
      title: 'CRP',
      source: '',
      perWeek: 1,
      subject: 'navigation',
    },
  ]
  const simLessons: SimLesson[] = [
    {
      id: 'sim-09',
      order: 9,
      title: 'Circuit',
      objectives: [],
      tolerances: [],
      status: 'passed',
      attempts: 2,
    },
  ]
  const base = { chapters: [chapter()], exercises, simLessons, weeklyGoal: 2 }
  const find = (list: ReturnType<typeof evaluateMilestones>, id: string) =>
    list.find((m) => m.id === id)

  it('reaches the first full session only with a whole block', () => {
    expect(
      find(
        evaluateMilestones({
          ...base,
          sessions: [session({ id: 'a', startedAt: at('2026-11-16'), activeMinutes: 10 })],
        }),
        'first-session',
      )?.reachedOn,
    ).toBeNull()
    expect(
      find(
        evaluateMilestones({
          ...base,
          sessions: [session({ id: 'a', startedAt: at('2026-11-16') })],
        }),
        'first-session',
      )?.reachedOn,
    ).toBe('2026-11-16')
  })

  it('reaches the first week when the weekly goal is met', () => {
    const sessions = [
      session({ id: 'a', startedAt: at('2026-11-16') }),
      session({ id: 'b', startedAt: at('2026-11-18') }),
    ]
    expect(find(evaluateMilestones({ ...base, sessions }), 'first-week')?.reachedOn).toBe(
      '2026-11-18',
    )
  })

  it('counts 10 hours on the day they are reached and shows progress before', () => {
    const sessions = Array.from({ length: 21 }, (_, i) =>
      session({ id: `s${i}`, startedAt: at('2026-11-01') + i * 86_400_000 }),
    )
    const m = evaluateMilestones({ ...base, sessions })
    expect(find(m, 'hours-10')?.reachedOn).toBe('2026-11-20')
    expect(find(m, 'hours-25')?.progress).toEqual({ value: 10.5, max: 25, unit: 'hours' })
  })

  it('marks chapters, subjects and the whole book', () => {
    const done = chapter({ completedOn: '2026-11-19', status: 'done' })
    const m = evaluateMilestones({ ...base, chapters: [done], sessions: [] })
    expect(find(m, 'chapter-cap-1')?.reachedOn).toBe('2026-11-19')
    expect(find(m, 'subject-meteorology')?.reachedOn).toBe('2026-11-19')
    expect(find(m, 'book-done')?.reachedOn).toBe('2026-11-19')
    expect(find(m, 'subject-navigation')).toBeUndefined()
  })

  it('needs a clean flight computer exercise', () => {
    const ex = (id: string, clean: boolean) =>
      session({
        id,
        startedAt: at('2026-11-16'),
        kind: 'exercise',
        ref: { type: 'exercise', id: 'es-regolo' },
        exerciseClean: clean,
      })
    expect(
      find(evaluateMilestones({ ...base, sessions: [ex('a', false)] }), 'first-clean-crp')
        ?.reachedOn,
    ).toBeNull()
    expect(
      find(evaluateMilestones({ ...base, sessions: [ex('a', true)] }), 'first-clean-crp')
        ?.reachedOn,
    ).toBe('2026-11-16')
  })

  it('needs a circuit flown within tolerances', () => {
    const flight = session({
      id: 'f',
      startedAt: at('2026-11-20'),
      kind: 'simulator',
      ref: { type: 'sim', id: 'sim-09' },
      simOutcome: 'passed',
    })
    expect(
      find(evaluateMilestones({ ...base, sessions: [flight] }), 'first-circuit')?.reachedOn,
    ).toBe('2026-11-20')
  })

  it('has no streak, point or level milestones', () => {
    const ids = evaluateMilestones({ ...base, sessions: [] })
      .map((m) => m.id)
      .join(' ')
    expect(ids).not.toMatch(/streak|point|level|opened/)
  })
})

describe('import merge', () => {
  const snapshot = (over: Partial<Snapshot['data']> = {}, exportedAt = 1): Snapshot => ({
    app: 'vector',
    version: 1,
    exportedAt,
    data: {
      settings: [{ ...defaultSettings(), onboarded: true }],
      chapters: [chapter()],
      exercises: [],
      simLessons: [],
      blocks: [],
      sessions: [],
      calibrations: [],
      milestones: [],
      weeklyReviews: [],
      active: [],
      ...over,
    },
  })

  it('adds sessions from both devices and never loses one', () => {
    const local = snapshot({ sessions: [session({ id: 'a', startedAt: 1 })] })
    const phone = snapshot({
      sessions: [session({ id: 'a', startedAt: 1 }), session({ id: 'b', startedAt: 2 })],
    })
    const { merged, summary } = mergeSnapshots(local, phone)
    expect(merged.data.sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(summary.newSessions).toBe(1)
    expect(mergeSnapshots(phone, local).merged.data.sessions).toHaveLength(2)
  })

  it('keeps the furthest progress on each chapter', () => {
    const local = snapshot({ chapters: [chapter({ pageReached: 20, status: 'in-progress' })] })
    const phone = snapshot({ chapters: [chapter({ pageReached: 15, status: 'in-progress' })] })
    expect(mergeSnapshots(local, phone).merged.data.chapters[0]?.pageReached).toBe(20)
    const finished = snapshot({
      chapters: [chapter({ pageReached: 29, status: 'done', completedOn: '2026-11-20' })],
    })
    const r = mergeSnapshots(local, finished)
    expect(r.merged.data.chapters[0]?.status).toBe('done')
    expect(r.summary.chaptersAdvanced).toEqual([
      { id: 'cap-1', title: 'Atmosfera', from: 20, to: 29 },
    ])
  })

  it('takes the settings of a set-up device on a fresh one', () => {
    const fresh = snapshot({ settings: [defaultSettings()] })
    const setUp = snapshot({ settings: [{ ...defaultSettings(), onboarded: true, pagesPer30: 9 }] })
    expect(mergeSnapshots(fresh, setUp).merged.data.settings[0]?.pagesPer30).toBe(9)
    expect(mergeSnapshots(setUp, fresh).merged.data.settings[0]?.pagesPer30).toBe(9)
  })

  it('keeps the first date of a milestone and carries over a session in progress', () => {
    const local = snapshot({ milestones: [{ id: 'm', reachedOn: '2026-11-20', seen: true }] })
    const timer = { totalMs: 1, startedAt: 5, runningSince: null, accumulatedMs: 0, pauses: 0 }
    const block = {
      id: 'b',
      date: '2026-11-20',
      order: 0,
      window: 'evening' as const,
      minutes: 30,
      kind: 'reading' as const,
      mode: 'desk' as const,
      ref: null,
      pageFrom: null,
      pageTo: null,
      content: '',
      status: 'planned' as const,
      why: { code: 'extra' as const, chapter: null, clarity: null, count: null },
      extra: true,
    }
    const phone = snapshot({
      milestones: [{ id: 'm', reachedOn: '2026-11-18', seen: false }],
      active: [
        { id: 'active', block, timer, leftApp: 0, hiddenAt: null, focus: null, pageReached: null },
      ],
    })
    const { merged, summary } = mergeSnapshots(local, phone)
    expect(merged.data.milestones[0]).toEqual({ id: 'm', reachedOn: '2026-11-18', seen: true })
    expect(summary.activeSession).toBe(true)
  })

  it('lets the newest settings win between set-up devices', () => {
    const old = snapshot({
      settings: [{ ...defaultSettings(), onboarded: true, pagesPer30: 6, updatedAt: 1 }],
    })
    const recent = snapshot({
      settings: [{ ...defaultSettings(), onboarded: true, pagesPer30: 8, updatedAt: 2 }],
    })
    expect(mergeSnapshots(old, recent).merged.data.settings[0]?.pagesPer30).toBe(8)
    expect(mergeSnapshots(recent, old).merged.data.settings[0]?.pagesPer30).toBe(8)
  })

  it('does not revive a session already logged on the other device', () => {
    const timer = { totalMs: 1, startedAt: 5, runningSince: null, accumulatedMs: 0, pauses: 0 }
    const block = {
      id: 'b',
      date: '2026-11-20',
      order: 0,
      window: 'evening' as const,
      minutes: 30,
      kind: 'reading' as const,
      mode: 'desk' as const,
      ref: null,
      pageFrom: null,
      pageTo: null,
      content: '',
      status: 'planned' as const,
      why: { code: 'extra' as const, chapter: null, clarity: null, count: null },
      extra: true,
    }
    const phone = snapshot({
      active: [
        { id: 'active', block, timer, leftApp: 0, hiddenAt: null, focus: null, pageReached: null },
      ],
    })
    const laptop = snapshot({ sessions: [session({ id: 'done', startedAt: 5 })] })
    expect(mergeSnapshots(laptop, phone).merged.data.active).toEqual([])
  })

  it('is idempotent', () => {
    const a = snapshot({ sessions: [session({ id: 'a', startedAt: 1 })] })
    const once = mergeSnapshots(a, a).merged
    expect(mergeSnapshots(once, a).merged).toEqual(once)
  })
})

describe('csv export', () => {
  it('neutralises spreadsheet formulas and quotes separators', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell(-5)).toBe('-5')
    expect(toCsv(['a', 'b'], [[1, null]])).toBe('a,b\r\n1,\r\n')
  })
})
