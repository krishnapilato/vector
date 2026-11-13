import { describe, expect, it } from 'vitest'
import type { ActiveSession, Chapter } from '../model/schemas'
import { startTimer } from './timer'
import { estimatePage, type WrapUp, wrapUpSession } from './wrapup'

const MIN = 60_000
const chapter: Chapter = {
  id: 'cap-4',
  order: 4,
  title: 'Portanza',
  subject: 'principles-of-flight',
  pageStart: 100,
  pageEnd: 139,
  difficulty: 1,
  pageReached: 111,
  status: 'in-progress',
  lastClarity: 3,
  completedOn: null,
}

function active(over: Partial<ActiveSession['block']> = {}): ActiveSession {
  return {
    id: 'active',
    block: {
      id: 'b1',
      date: '2026-11-16',
      order: 0,
      window: 'evening',
      minutes: 30,
      kind: 'reading',
      mode: 'desk',
      ref: { type: 'chapter', id: 'cap-4' },
      pageFrom: 112,
      pageTo: 124,
      content: 'p. 112–124',
      status: 'planned',
      why: { code: 'reading-next', chapter: 4, clarity: null, count: null },
      extra: false,
      ...over,
    },
    timer: startTimer(0, 30 * MIN),
    leftApp: 0,
    hiddenAt: null,
    focus: null,
    pageReached: null,
  }
}

const input = (over: Partial<WrapUp> = {}): WrapUp => ({
  clarity: 4,
  pageReached: 124,
  note: '',
  quizScore: null,
  simOutcome: null,
  simDeviations: '',
  exerciseClean: null,
  minutesOverride: null,
  ...over,
})

describe('wrap-up', () => {
  it('estimates the page reached from the time spent', () => {
    expect(estimatePage(active(), 30 * MIN)).toBe(124)
    expect(estimatePage(active(), 15 * MIN)).toBe(118)
  })

  it('moves the chapter forward and logs the session', () => {
    const r = wrapUpSession({
      id: 's',
      active: active(),
      now: 32 * MIN,
      input: input(),
      chapter,
      simLesson: null,
      pagesPer30: 6,
      focus: null,
    })
    expect(r.chapter).toMatchObject({ pageReached: 124, status: 'in-progress', lastClarity: 4 })
    expect(r.session).toMatchObject({
      activeMinutes: 30,
      clarity: 4,
      pageReached: 124,
      kind: 'reading',
    })
    expect(r.feedback).toEqual({
      minutes: 30,
      attention: null,
      chapterOrder: 4,
      chapterPercent: 63,
    })
  })

  it('finishes the chapter on its last page', () => {
    const r = wrapUpSession({
      id: 's',
      active: active(),
      now: 30 * MIN,
      input: input({ pageReached: 139 }),
      chapter,
      simLesson: null,
      pagesPer30: 6,
      focus: null,
    })
    expect(r.chapter?.status).toBe('done')
    expect(r.chapter?.completedOn).toBeTruthy()
  })

  it('never moves a chapter backwards', () => {
    const r = wrapUpSession({
      id: 's',
      active: active(),
      now: 30 * MIN,
      input: input({ pageReached: 105 }),
      chapter,
      simLesson: null,
      pagesPer30: 6,
      focus: null,
    })
    expect(r.chapter?.pageReached).toBe(111)
  })

  it('measures the reading pace, smoothly', () => {
    const r = wrapUpSession({
      id: 's',
      active: active(),
      now: 30 * MIN,
      input: input({ pageReached: 131 }),
      chapter,
      simLesson: null,
      pagesPer30: 6,
      focus: null,
    })
    expect(r.pagesPer30).toBe(10.2)
  })

  it('records a quiz score and a simulator outcome', () => {
    const quiz = wrapUpSession({
      id: 's',
      active: active({ kind: 'quiz', pageFrom: null, pageTo: null }),
      now: 20 * MIN,
      input: input({ quizScore: { correct: 18, total: 20 } }),
      chapter,
      simLesson: null,
      pagesPer30: 6,
      focus: null,
    })
    expect(quiz.session.quizScore).toEqual({ correct: 18, total: 20 })
    expect(quiz.chapter).toBeNull()
    const lesson = {
      id: 'sim-09',
      order: 9,
      title: 'Circuit',
      objectives: [],
      tolerances: [],
      status: 'not-started' as const,
      attempts: 0,
    }
    const sim = wrapUpSession({
      id: 's',
      active: active({ kind: 'simulator', mode: 'simulator', ref: { type: 'sim', id: 'sim-09' } }),
      now: 50 * MIN,
      input: input({ simOutcome: 'repeat', simDeviations: 'Downwind high', minutesOverride: 45 }),
      chapter: null,
      simLesson: lesson,
      pagesPer30: 6,
      focus: null,
    })
    expect(sim.simLesson).toMatchObject({ status: 'repeat', attempts: 1 })
    expect(sim.session.activeMinutes).toBe(45)
  })
})
