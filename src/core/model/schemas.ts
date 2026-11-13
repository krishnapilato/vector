/**
 * Data model (PIANO-V3-LITE §7): three tables only. Zod schemas are the single definition; the
 * types are inferred. Modules that only need types import them with `import type`, so Zod stays
 * out of the Focus page bundle.
 */
import { z } from 'zod'

export const sensitivities = ['low', 'normal', 'high'] as const
export const Sensitivity = z.enum(sensitivities)
export type Sensitivity = z.infer<typeof Sensitivity>

export const Settings = z.object({
  id: z.literal('default'),
  /** Minutes; 0 means Open (stopwatch). */
  defaultDurationMin: z.number().int().min(0).max(180),
  alwaysShowTimer: z.boolean(),
  soundEnabled: z.boolean(),
  cameraEnabledByDefault: z.boolean(),
  sensitivity: Sensitivity,
  activeCalibrationId: z.string().nullable(),
})
export type Settings = z.infer<typeof Settings>

export const Calibration = z.object({
  id: z.string().min(1),
  /** The workstation, e.g. "Desk" or "Laptop". */
  label: z.string().min(1).max(40),
  meanYaw: z.number(),
  sdYaw: z.number().min(0),
  meanPitch: z.number(),
  sdPitch: z.number().min(0),
  createdAt: z.number(),
})
export type Calibration = z.infer<typeof Calibration>

export const FocusAggregates = z.object({
  activeSeconds: z.number().min(0),
  focusedSeconds: z.number().min(0),
  distractedSeconds: z.number().min(0),
  awaySeconds: z.number().min(0),
  distractionCount: z.number().int().min(0),
  fatigueEvents: z.number().int().min(0),
  breaksSuggested: z.number().int().min(0),
  breaksAccepted: z.number().int().min(0),
  /** Focused share of active camera time, 0–100. */
  focusScorePct: z.number().min(0).max(100),
})
export type FocusAggregates = z.infer<typeof FocusAggregates>

export const ClarityRating = z.literal([1, 2, 3, 4, 5])
export type ClarityRating = z.infer<typeof ClarityRating>

export const Session = z.object({
  id: z.string().min(1),
  /** What the learner worked on, free text: "Trebbi Ch. 4", "Deep work". */
  tag: z.string().max(60),
  startedAt: z.number(),
  endedAt: z.number(),
  activeSeconds: z.number().min(0),
  pauseCount: z.number().int().min(0),
  cameraUsed: z.boolean(),
  focusAggregates: FocusAggregates.nullable(),
  clarityRating: ClarityRating,
  note: z.string().max(200),
})
export type Session = z.infer<typeof Session>

/** Timestamp-based timer: it survives reloads because it never counts ticks. */
export const TimerState = z.object({
  /** Planned length; null for Open (stopwatch) sessions. */
  totalMs: z.number().min(0).nullable(),
  startedAt: z.number(),
  /** Epoch ms of the current running stretch; null while paused. */
  runningSince: z.number().nullable(),
  /** Active ms accumulated before the current running stretch. */
  accumulatedMs: z.number().min(0),
  pauses: z.number().int().min(0),
})
export type TimerState = z.infer<typeof TimerState>

/**
 * The session in progress. Kept in localStorage, not in a fourth table (ADR 0010): it is small,
 * read before the database loads, and gone as soon as the session is saved.
 */
export const ActiveSession = z.object({
  tag: z.string().max(60),
  cameraUsed: z.boolean(),
  timer: TimerState,
  hiddenAt: z.number().nullable(),
  /** Set when End is pressed: the session waits for its wrap-up, even after a reload. */
  endedAt: z.number().nullable(),
  focusAggregates: FocusAggregates.nullable(),
})
export type ActiveSession = z.infer<typeof ActiveSession>

/** A full backup file (PIANO-V3-LITE §4.3). */
export const Backup = z.object({
  app: z.literal('vector'),
  version: z.literal(3),
  exportedAt: z.number(),
  settings: Settings.nullable(),
  calibrations: z.array(Calibration),
  sessions: z.array(Session),
})
export type Backup = z.infer<typeof Backup>
