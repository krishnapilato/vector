/**
 * Data model (PIANO-V3 §8). Zod schemas are the single definition; the types are inferred.
 * Modules that only need types import them with `import type`, so Zod stays out of pages that
 * never validate anything (e.g. Today, which must ship < 60 kB of JS).
 */
import { z } from 'zod'
import { subjectIds } from './subjects'

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date like 2026-11-13')
export type ISODate = string

/** Time windows a block can sit in. `commute` means on the go: phone, no camera, short blocks. */
export const windows = ['morning', 'lunch', 'evening', 'commute'] as const
export const Window = z.enum(windows)
export type Window = z.infer<typeof Window>

export const Slot = z.object({ window: Window, blocks: z.number().int().min(1).max(4) })
export type Slot = z.infer<typeof Slot>

/** Seven days, Monday first. */
export const Availability = z.array(z.array(Slot)).length(7)
export type Availability = z.infer<typeof Availability>

export const Split = z.object({
  book: z.number().min(0).max(1),
  exercises: z.number().min(0).max(1),
  simulator: z.number().min(0).max(1),
})
export type Split = z.infer<typeof Split>

export const sensitivities = ['low', 'normal', 'high'] as const
export const Sensitivity = z.enum(sensitivities)
export type Sensitivity = z.infer<typeof Sensitivity>

export const Settings = z.object({
  id: z.literal('settings'),
  onboarded: z.boolean(),
  bookEdition: z.string(),
  targetDate: isoDate.nullable(),
  availability: Availability,
  pagesPer30: z.number().min(1).max(40),
  blockMinutes: z.number().int().min(10).max(90),
  split: Split,
  simUnlockAfter: z.number().int().min(0).max(10),
  camera: z.boolean(),
  sensitivity: Sensitivity,
  station: z.string().min(1).max(40),
  sounds: z.boolean(),
  alwaysShowTimer: z.boolean(),
  pauseWhenAway: z.boolean(),
  lastBackupAt: z.number().nullable(),
})
export type Settings = z.infer<typeof Settings>

export const chapterStatuses = ['not-started', 'in-progress', 'done', 'review'] as const
export const ChapterStatus = z.enum(chapterStatuses)
export type ChapterStatus = z.infer<typeof ChapterStatus>

export const Difficulty = z.literal([1, 2, 3])
export type Difficulty = z.infer<typeof Difficulty>

export const Clarity = z.literal([1, 2, 3, 4, 5])
export type Clarity = z.infer<typeof Clarity>

export const SubjectId = z.enum(subjectIds)

export const Chapter = z
  .object({
    id: z.string().min(1),
    order: z.number().int().min(0),
    title: z.string().min(1),
    subject: SubjectId,
    pageStart: z.number().int().min(1),
    pageEnd: z.number().int().min(1),
    difficulty: Difficulty,
    /** Last page read, inclusive; null before the first reading block. */
    pageReached: z.number().int().nullable(),
    status: ChapterStatus,
    lastClarity: Clarity.nullable(),
    completedOn: isoDate.nullable(),
  })
  .refine((c) => c.pageEnd >= c.pageStart, 'The last page comes before the first one.')
export type Chapter = z.infer<typeof Chapter>

export const exerciseKinds = [
  'flight-computer',
  'nav-planning',
  'weather',
  'mass-balance',
  'performance',
  'radio',
] as const
export const ExerciseKind = z.enum(exerciseKinds)
export type ExerciseKind = z.infer<typeof ExerciseKind>

export const Exercise = z.object({
  id: z.string().min(1),
  kind: ExerciseKind,
  title: z.string().min(1),
  source: z.string(),
  perWeek: z.number().int().min(0).max(7),
  subject: SubjectId,
})
export type Exercise = z.infer<typeof Exercise>

export const simStatuses = ['not-started', 'passed', 'repeat'] as const
export const SimStatus = z.enum(simStatuses)
export type SimStatus = z.infer<typeof SimStatus>

export const SimLesson = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  title: z.string().min(1),
  objectives: z.array(z.string()),
  tolerances: z.array(z.string()),
  status: SimStatus,
  attempts: z.number().int().min(0),
})
export type SimLesson = z.infer<typeof SimLesson>

export const blockKinds = ['reading', 'review', 'exercise', 'quiz', 'simulator'] as const
export const BlockKind = z.enum(blockKinds)
export type BlockKind = z.infer<typeof BlockKind>

export const modes = ['desk', 'on-the-go', 'simulator'] as const
export const Mode = z.enum(modes)
export type Mode = z.infer<typeof Mode>

export const blockStatuses = ['planned', 'done', 'skipped', 'moved'] as const
export const BlockStatus = z.enum(blockStatuses)
export type BlockStatus = z.infer<typeof BlockStatus>

export const BlockRef = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chapter'), id: z.string() }),
  z.object({ type: z.literal('exercise'), id: z.string() }),
  z.object({ type: z.literal('sim'), id: z.string() }),
])
export type BlockRef = z.infer<typeof BlockRef>

/**
 * Why a block is in the plan (PIANO-V3 §2.5, §6.10). Stored as data, worded by src/lib/copy.ts.
 */
export const reasonCodes = [
  'reading-next',
  'reading-finish',
  'review',
  'quiz',
  'exercise',
  'simulator',
  'commute',
  'quick',
  'extra',
] as const
export const Reason = z.object({
  code: z.enum(reasonCodes),
  /** Chapter number (order) the reason talks about. */
  chapter: z.number().int().nullable(),
  clarity: z.number().int().nullable(),
  /** Which review this is, or how many theory blocks unlock the flight. */
  count: z.number().int().nullable(),
})
export type Reason = z.infer<typeof Reason>

export const Block = z.object({
  id: z.string().min(1),
  date: isoDate,
  /** Position within the day, 0 first. */
  order: z.number().int().min(0),
  window: Window,
  minutes: z.number().int().min(5).max(180),
  kind: BlockKind,
  mode: Mode,
  ref: BlockRef.nullable(),
  pageFrom: z.number().int().nullable(),
  pageTo: z.number().int().nullable(),
  content: z.string(),
  status: BlockStatus,
  why: Reason,
  extra: z.boolean(),
})
export type Block = z.infer<typeof Block>

export const FocusAggregate = z.object({
  activeSeconds: z.number().min(0),
  focusedSeconds: z.number().min(0),
  distractedSeconds: z.number().min(0),
  awaySeconds: z.number().min(0),
  tiredSeconds: z.number().min(0),
  distractions: z.number().int().min(0),
  breaksSuggested: z.number().int().min(0),
  breaksAccepted: z.number().int().min(0),
  breaksDeclined: z.number().int().min(0),
  /** Focused share of active time, 0–1. */
  attention: z.number().min(0).max(1),
  fatigueAvg: z.number().min(0).max(1),
  fatigueMax: z.number().min(0).max(1),
})
export type FocusAggregate = z.infer<typeof FocusAggregate>

export const QuizScore = z
  .object({ correct: z.number().int().min(0), total: z.number().int().min(1) })
  .refine((q) => q.correct <= q.total, 'More correct answers than questions.')
export type QuizScore = z.infer<typeof QuizScore>

export const Session = z.object({
  id: z.string().min(1),
  blockId: z.string().nullable(),
  kind: BlockKind,
  mode: Mode,
  subject: SubjectId.nullable(),
  ref: BlockRef.nullable(),
  content: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  activeMinutes: z.number().min(0),
  pauses: z.number().int().min(0),
  leftApp: z.number().int().min(0),
  clarity: Clarity.nullable(),
  pageReached: z.number().int().nullable(),
  note: z.string(),
  quizScore: QuizScore.nullable(),
  simOutcome: z.enum(['passed', 'repeat']).nullable(),
  simDeviations: z.string(),
  exerciseClean: z.boolean().nullable(),
  focus: FocusAggregate.nullable(),
})
export type Session = z.infer<typeof Session>

export const Calibration = z.object({
  station: z.string().min(1),
  yawMean: z.number(),
  yawSd: z.number().min(0),
  pitchMean: z.number(),
  pitchSd: z.number().min(0),
  /** Eyelid score while reading: looking down at paper closes the eyes a little. */
  blinkMean: z.number().min(0).max(1),
  date: z.number(),
})
export type Calibration = z.infer<typeof Calibration>

export const Milestone = z.object({
  id: z.string().min(1),
  reachedOn: isoDate,
  seen: z.boolean(),
})
export type Milestone = z.infer<typeof Milestone>

export const feelings = ['heavy', 'right', 'light'] as const
export const Feeling = z.enum(feelings)
export type Feeling = z.infer<typeof Feeling>

export const WeeklyReview = z.object({
  /** Monday of the reviewed week. */
  week: isoDate,
  feeling: Feeling,
  factor: z.number().min(0.5).max(1.5),
  doneAt: z.number(),
})
export type WeeklyReview = z.infer<typeof WeeklyReview>

/** Timestamp-based timer: it survives reloads because it never counts ticks. */
export const TimerState = z.object({
  totalMs: z.number().min(0),
  startedAt: z.number(),
  /** Epoch ms of the current running stretch; null while paused. */
  runningSince: z.number().nullable(),
  /** Active ms accumulated before the current running stretch. */
  accumulatedMs: z.number().min(0),
  pauses: z.number().int().min(0),
})
export type TimerState = z.infer<typeof TimerState>

/** The session in progress, kept in the database so it resumes after the browser closes. */
export const ActiveSession = z.object({
  id: z.literal('active'),
  block: Block,
  timer: TimerState,
  leftApp: z.number().int().min(0),
  hiddenAt: z.number().nullable(),
  focus: FocusAggregate.nullable(),
  pageReached: z.number().int().nullable(),
})
export type ActiveSession = z.infer<typeof ActiveSession>

/** A full export of the database (PIANO-V3 §8, backup). */
export const Snapshot = z.object({
  app: z.literal('vector'),
  version: z.literal(1),
  exportedAt: z.number(),
  data: z.object({
    settings: z.array(Settings),
    chapters: z.array(Chapter),
    exercises: z.array(Exercise),
    simLessons: z.array(SimLesson),
    blocks: z.array(Block),
    sessions: z.array(Session),
    calibrations: z.array(Calibration),
    milestones: z.array(Milestone),
    weeklyReviews: z.array(WeeklyReview),
    /** The session in progress, if any: it can be continued on another device. */
    active: z.array(ActiveSession).max(1),
  }),
})
export type Snapshot = z.infer<typeof Snapshot>
