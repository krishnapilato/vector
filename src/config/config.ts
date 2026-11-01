import * as z from 'zod/mini'
import defaults from './defaults.json'

// zod/mini: the same validation as zod at a fraction of the size.
const int = (min: number, max: number) => z.int().check(z.minimum(min), z.maximum(max))

export const configSchema = z.strictObject({
  version: z.literal(1),
  timers: z.object({
    recall: int(1, 3600),
    reasoning: int(1, 3600),
    calculation: int(1, 3600),
    open: int(1, 3600),
  }),
  pomodoro: z.object({
    focusMinutes: int(1, 180),
    shortBreakMinutes: int(1, 180),
    longBreakMinutes: int(1, 180),
    cyclesBeforeLongBreak: int(1, 12),
  }),
  session: z.object({
    length: int(1, 50),
    newConcepts: int(0, 20),
  }),
  quiz: z.object({
    thinkFirstSeconds: int(0, 30),
    whyProbability: z.number().check(z.minimum(0), z.maximum(1)),
  }),
  focus: z
    .object({
      ignoreDistractionSeconds: int(0, 60),
      pauseAfterSeconds: int(1, 600),
    })
    .check(
      z.refine((f) => f.pauseAfterSeconds > f.ignoreDistractionSeconds, {
        message: 'pauseAfterSeconds must be greater than ignoreDistractionSeconds',
        path: ['pauseAfterSeconds'],
      }),
    ),
})

export type Config = z.infer<typeof configSchema>

/** Parses user-supplied JSON. Invalid input is rejected, never half-applied. */
export function parseConfig(input: unknown): Config {
  return configSchema.parse(input)
}

export const defaultConfig: Config = parseConfig(defaults)
