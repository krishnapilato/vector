import { z } from 'zod'
import defaults from './defaults.json'

const seconds = z.number().int().positive().max(3600)
const minutes = z.number().int().positive().max(180)

export const configSchema = z
  .object({
    version: z.literal(1),
    timers: z.object({
      recall: seconds,
      reasoning: seconds,
      calculation: seconds,
      open: seconds,
    }),
    pomodoro: z.object({
      focusMinutes: minutes,
      shortBreakMinutes: minutes,
      longBreakMinutes: minutes,
      cyclesBeforeLongBreak: z.number().int().min(1).max(12),
    }),
    focus: z
      .object({
        ignoreDistractionSeconds: z.number().int().min(0).max(60),
        pauseAfterSeconds: z.number().int().min(1).max(600),
      })
      .refine((f) => f.pauseAfterSeconds > f.ignoreDistractionSeconds, {
        message: 'pauseAfterSeconds must be greater than ignoreDistractionSeconds',
        path: ['pauseAfterSeconds'],
      }),
  })
  .strict()

export type Config = z.infer<typeof configSchema>

/** Parses user-supplied JSON. Invalid input is rejected, never half-applied. */
export function parseConfig(input: unknown): Config {
  return configSchema.parse(input)
}

export const defaultConfig: Config = parseConfig(defaults)
