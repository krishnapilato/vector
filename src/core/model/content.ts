/**
 * Starting content written by hand in src/content/*.json (PIANO-V3 §16). The files use the
 * Italian keys of the plan; here they are validated and turned into the app's model.
 */
import { z } from 'zod'
import type { Chapter, Exercise, ExerciseKind, SimLesson } from './schemas'
import { Difficulty } from './schemas'
import { subjectFileIds, subjectFromFile } from './subjects'

const uniqueIds = (items: { id: string }[]) => new Set(items.map((i) => i.id)).size === items.length

export const TrebbiFile = z.object({
  edizione: z.string(),
  capitoli: z
    .array(
      z
        .object({
          id: z.string().min(1),
          ordine: z.number().int().min(0),
          titolo: z.string().min(1),
          materia: z.enum(subjectFileIds),
          paginaInizio: z.number().int().min(1),
          paginaFine: z.number().int().min(1),
          difficolta: Difficulty,
        })
        .refine((c) => c.paginaFine >= c.paginaInizio, {
          message: 'paginaFine comes before paginaInizio',
        }),
    )
    .min(1)
    .refine(uniqueIds, 'Two chapters share the same id'),
})
export type TrebbiFile = z.infer<typeof TrebbiFile>

const exerciseKindFromFile = {
  regolo: 'flight-computer',
  pianificazione: 'nav-planning',
  meteo: 'weather',
  'peso-centraggio': 'mass-balance',
  prestazioni: 'performance',
  radio: 'radio',
} as const satisfies Record<string, ExerciseKind>

export const ExercisesFile = z.object({
  esercizi: z
    .array(
      z.object({
        id: z.string().min(1),
        tipo: z.enum(Object.keys(exerciseKindFromFile) as [keyof typeof exerciseKindFromFile]),
        titolo: z.string().min(1),
        fonte: z.string(),
        frequenzaSettimanale: z.number().int().min(0).max(7),
        materia: z.enum(subjectFileIds),
      }),
    )
    .refine(uniqueIds, 'Two exercises share the same id'),
})
export type ExercisesFile = z.infer<typeof ExercisesFile>

export const SimLessonsFile = z.object({
  lezioni: z
    .array(
      z.object({
        id: z.string().min(1),
        ordine: z.number().int().min(0),
        titolo: z.string().min(1),
        obiettivi: z.array(z.string()),
        tolleranze: z.array(z.string()),
      }),
    )
    .refine(uniqueIds, 'Two lessons share the same id'),
})
export type SimLessonsFile = z.infer<typeof SimLessonsFile>

export interface StartingContent {
  edition: string
  chapters: Chapter[]
  exercises: Exercise[]
  simLessons: SimLesson[]
}

/** Validates the three content files; throws with Zod's message if one is wrong. */
export function parseContent(trebbi: unknown, exercises: unknown, sim: unknown): StartingContent {
  const t = TrebbiFile.parse(trebbi)
  const e = ExercisesFile.parse(exercises)
  const s = SimLessonsFile.parse(sim)
  return {
    edition: t.edizione,
    chapters: t.capitoli
      .toSorted((a, b) => a.ordine - b.ordine)
      .map((c) => ({
        id: c.id,
        order: c.ordine,
        title: c.titolo,
        subject: subjectFromFile(c.materia),
        pageStart: c.paginaInizio,
        pageEnd: c.paginaFine,
        difficulty: c.difficolta,
        pageReached: null,
        status: 'not-started',
        lastClarity: null,
        completedOn: null,
      })),
    exercises: e.esercizi.map((x) => ({
      id: x.id,
      kind: exerciseKindFromFile[x.tipo],
      title: x.titolo,
      source: x.fonte,
      perWeek: x.frequenzaSettimanale,
      subject: subjectFromFile(x.materia),
    })),
    simLessons: s.lezioni
      .toSorted((a, b) => a.ordine - b.ordine)
      .map((l) => ({
        id: l.id,
        order: l.ordine,
        title: l.titolo,
        objectives: l.obiettivi,
        tolerances: l.tolleranze,
        status: 'not-started',
        attempts: 0,
      })),
  }
}
