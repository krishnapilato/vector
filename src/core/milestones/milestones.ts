/**
 * Milestones (PIANO-V3 §9): few and meaningful, each tied to real progress. No streaks, points,
 * levels or badges for trivial actions. Pure rules: the same history gives the same milestones.
 */
import { localDate, mondayOf } from '../calendar/dates'
import type { Chapter, Exercise, ExerciseKind, ISODate, Session, SimLesson } from '../model/schemas'
import { type SubjectId, subjects } from '../model/subjects'

export interface MilestoneState {
  id: string
  title: string
  sentence: string
  /** First day it was reached, or null. */
  reachedOn: ISODate | null
  /** For the next milestones: how far along. */
  progress: { value: number; max: number; unit: 'hours' | 'chapters' | 'blocks' | 'none' } | null
}

export interface MilestoneInput {
  sessions: readonly Session[]
  chapters: readonly Chapter[]
  simLessons: readonly SimLesson[]
  exercises: readonly Exercise[]
  /** Planned blocks per week (the weekly goal). */
  weeklyGoal: number
}

const day = (s: Session): ISODate => localDate(s.startedAt)

/** Date when a running total first reaches `target`. */
function reachedAt(
  sessions: readonly Session[],
  value: (s: Session) => number,
  target: number,
): ISODate | null {
  let total = 0
  for (const s of sessions.toSorted((a, b) => a.startedAt - b.startedAt)) {
    total += value(s)
    if (total >= target) return day(s)
  }
  return null
}

const hours = (s: Session) => s.activeMinutes / 60

export function evaluateMilestones(input: MilestoneInput): MilestoneState[] {
  const sessions = input.sessions.toSorted((a, b) => a.startedAt - b.startedAt)
  const totalHours = sessions.reduce((n, s) => n + hours(s), 0)
  const out: MilestoneState[] = []

  const firstFull = sessions.find((s) => s.activeMinutes >= 25 && s.mode !== 'on-the-go')
  out.push({
    id: 'first-session',
    title: 'First full session',
    sentence: 'A whole block, start to finish. The logbook has its first line.',
    reachedOn: firstFull ? day(firstFull) : null,
    progress: null,
  })

  // First week in which the weekly goal was met.
  const perWeek = new Map<string, Session[]>()
  for (const s of sessions) {
    const week = mondayOf(day(s))
    perWeek.set(week, [...(perWeek.get(week) ?? []), s])
  }
  let firstWeek: ISODate | null = null
  for (const [, list] of [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const goalSession = list[Math.max(0, input.weeklyGoal - 1)]
    if (input.weeklyGoal > 0 && list.length >= input.weeklyGoal && goalSession) {
      firstWeek = day(goalSession)
      break
    }
  }
  const thisWeek = [...perWeek.values()].at(-1)?.length ?? 0
  out.push({
    id: 'first-week',
    title: 'First full week',
    sentence: 'Every block of the week goal, done.',
    reachedOn: firstWeek,
    progress: {
      value: Math.min(thisWeek, input.weeklyGoal),
      max: input.weeklyGoal,
      unit: 'blocks',
    },
  })

  for (const target of [10, 25, 50, 100]) {
    out.push({
      id: `hours-${target}`,
      title: `${target} hours of active study`,
      sentence: `${target} hours of real, focused work.`,
      reachedOn: reachedAt(sessions, hours, target),
      progress: { value: Math.round(totalHours * 10) / 10, max: target, unit: 'hours' },
    })
  }

  for (const c of input.chapters.toSorted((a, b) => a.order - b.order)) {
    out.push({
      id: `chapter-${c.id}`,
      title: `Chapter ${c.order} done`,
      sentence: `${c.title}: read to the end.`,
      reachedOn: c.completedOn,
      progress: null,
    })
  }

  for (const subject of subjects) {
    const list = input.chapters.filter((c) => c.subject === (subject.id as SubjectId))
    if (list.length === 0) continue
    const done = list.filter((c) => c.completedOn !== null)
    const dates = done
      .map((c) => c.completedOn)
      .filter((d): d is string => d !== null)
      .sort()
    out.push({
      id: `subject-${subject.id}`,
      title: `${subject.name} done`,
      sentence: `Every chapter of ${subject.name} read.`,
      reachedOn: done.length === list.length ? (dates.at(-1) ?? null) : null,
      progress: { value: done.length, max: list.length, unit: 'chapters' },
    })
  }

  const all = input.chapters
  const allDates = all
    .map((c) => c.completedOn)
    .filter((d): d is string => d !== null)
    .sort()
  out.push({
    id: 'book-done',
    title: 'Trebbi finished',
    sentence: 'The whole book, cover to cover.',
    reachedOn: all.length > 0 && allDates.length === all.length ? (allDates.at(-1) ?? null) : null,
    progress: { value: allDates.length, max: all.length, unit: 'chapters' },
  })

  const kindOf = new Map(input.exercises.map((e) => [e.id, e.kind]))
  const firstExercise = (kind: ExerciseKind, clean: boolean) =>
    sessions.find(
      (s) =>
        s.kind === 'exercise' &&
        s.ref?.type === 'exercise' &&
        kindOf.get(s.ref.id) === kind &&
        (!clean || s.exerciseClean === true),
    )
  const nav = firstExercise('nav-planning', false)
  out.push({
    id: 'first-nav-plan',
    title: 'First navigation planned by hand',
    sentence: 'Chart, ruler, flight computer: a full VFR route.',
    reachedOn: nav ? day(nav) : null,
    progress: null,
  })
  const crp = firstExercise('flight-computer', true)
  out.push({
    id: 'first-clean-crp',
    title: 'First flight computer exercise without errors',
    sentence: 'Every answer right on the flight computer.',
    reachedOn: crp ? day(crp) : null,
    progress: null,
  })

  const passedLesson = (match: RegExp) => {
    const lesson = input.simLessons.find((l) => match.test(l.title))
    if (!lesson) return null
    const s = sessions.find(
      (x) =>
        x.kind === 'simulator' &&
        x.ref?.type === 'sim' &&
        x.ref.id === lesson.id &&
        x.simOutcome === 'passed',
    )
    return s ? day(s) : null
  }
  out.push({
    id: 'first-circuit',
    title: 'First circuit within tolerances',
    sentence: 'Height, speed and track where they should be, all the way round.',
    reachedOn: passedLesson(/circuit/i),
    progress: null,
  })
  out.push({
    id: 'first-sim-nav',
    title: 'First simulator navigation',
    sentence: 'A planned route flown by heading and time.',
    reachedOn: passedLesson(/navigation/i),
    progress: null,
  })

  return out
}
