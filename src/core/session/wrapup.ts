/**
 * Closing a session (PIANO-V3 §5.4): three inputs with defaults, then the logbook line, the
 * chapter's progress, the simulator lesson and the measured reading pace are updated.
 */
import { localDate } from '../calendar/dates'
import type {
  ActiveSession,
  Chapter,
  Clarity,
  FocusAggregate,
  QuizScore,
  Session,
  SimLesson,
} from '../model/schemas'
import { difficultyWeight } from '../planner/content'
import { activeMs } from './timer'

export interface WrapUp {
  clarity: Clarity | null
  pageReached: number | null
  note: string
  quizScore: QuizScore | null
  simOutcome: 'passed' | 'repeat' | null
  simDeviations: string
  exerciseClean: boolean | null
  /** For the simulator, minutes flown when logged by hand. */
  minutesOverride: number | null
}

/** The page we guess you reached: the end if the block ran out, otherwise in proportion. */
export function estimatePage(active: ActiveSession, now: number): number | null {
  const { block, timer } = active
  if (active.pageReached !== null) return active.pageReached
  if (block.pageFrom === null || block.pageTo === null) return null
  const share = timer.totalMs > 0 ? activeMs(timer, now) / timer.totalMs : 1
  const pages = block.pageTo - block.pageFrom + 1
  return Math.min(
    block.pageTo,
    Math.max(block.pageFrom, block.pageFrom + Math.round(pages * share) - 1),
  )
}

export interface WrapUpResult {
  session: Session
  chapter: Chapter | null
  simLesson: SimLesson | null
  /** New pages per 30 minutes, when a reading block measured it. */
  pagesPer30: number | null
  feedback: {
    minutes: number
    attention: number | null
    chapterOrder: number | null
    chapterPercent: number | null
  }
}

export function wrapUpSession(args: {
  id: string
  active: ActiveSession
  now: number
  input: WrapUp
  chapter: Chapter | null
  simLesson: SimLesson | null
  pagesPer30: number
  focus: FocusAggregate | null
}): WrapUpResult {
  const { active, now, input, chapter, simLesson } = args
  const { block, timer } = active
  const minutes = input.minutesOverride ?? Math.round(activeMs(timer, now) / 60_000)
  const today = localDate(now)

  let updated: Chapter | null = null
  let pace: number | null = null
  if (chapter && (block.kind === 'reading' || block.kind === 'review')) {
    updated = { ...chapter, lastClarity: input.clarity ?? chapter.lastClarity }
    if (block.kind === 'reading' && input.pageReached !== null) {
      const before = chapter.pageReached ?? chapter.pageStart - 1
      const reached = Math.min(chapter.pageEnd, Math.max(before, input.pageReached))
      const finished = reached >= chapter.pageEnd
      updated = {
        ...updated,
        pageReached: reached,
        status: finished ? 'done' : 'in-progress',
        completedOn: finished ? (chapter.completedOn ?? today) : chapter.completedOn,
      }
      const pages = reached - before
      if (minutes >= 10 && pages > 0) {
        const measured = (pages / minutes) * 30 * difficultyWeight[chapter.difficulty]
        pace = Math.min(
          40,
          Math.max(1, Math.round((0.7 * args.pagesPer30 + 0.3 * measured) * 10) / 10),
        )
      }
    }
  }

  const lesson =
    simLesson && block.kind === 'simulator' && input.simOutcome
      ? { ...simLesson, status: input.simOutcome, attempts: simLesson.attempts + 1 }
      : null

  const session: Session = {
    id: args.id,
    blockId: block.id,
    kind: block.kind,
    mode: block.mode,
    subject: chapter?.subject ?? null,
    ref: block.ref,
    content: block.content,
    startedAt: timer.startedAt,
    endedAt: now,
    activeMinutes: minutes,
    pauses: timer.pauses,
    leftApp: active.leftApp,
    clarity: input.clarity,
    pageReached: block.kind === 'reading' ? input.pageReached : null,
    note: input.note.trim().slice(0, 280),
    quizScore: block.kind === 'quiz' ? input.quizScore : null,
    simOutcome: block.kind === 'simulator' ? input.simOutcome : null,
    simDeviations: block.kind === 'simulator' ? input.simDeviations.trim().slice(0, 280) : '',
    exerciseClean: block.kind === 'exercise' ? input.exerciseClean : null,
    focus: args.focus,
  }

  const chapterNow = updated ?? chapter
  const percent =
    chapterNow && chapterNow.pageReached !== null
      ? Math.round(
          ((Math.min(chapterNow.pageEnd, chapterNow.pageReached) - chapterNow.pageStart + 1) /
            (chapterNow.pageEnd - chapterNow.pageStart + 1)) *
            100,
        )
      : null

  return {
    session,
    chapter: updated,
    simLesson: lesson,
    pagesPer30: pace,
    feedback: {
      minutes,
      attention: args.focus ? Math.round(args.focus.attention * 100) : null,
      chapterOrder: chapterNow?.order ?? null,
      chapterPercent: block.kind === 'reading' ? percent : null,
    },
  }
}
