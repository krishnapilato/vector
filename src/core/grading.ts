import { msg } from './i18n'
/**
 * Grading turns one answer into a verdict and a spaced-repetition rating.
 * The rules exist to stop memorization: a lucky guess, a right answer for the
 * wrong reason, or a recognized wording does not count as knowing the concept.
 */

export type Confidence = 'sure' | 'unsure' | 'guess'

/** Same numbers as ts-fsrs Rating: Again 1, Hard 2, Good 3. */
export type ReviewRating = 1 | 2 | 3

export type Verdict =
  | 'solid' // right, sure, reasoned
  | 'shaky' // right but unsure
  | 'recognized' // right, but on a wording seen before and faster than reading it
  | 'guessed' // right by chance
  | 'reason-wrong' // right answer, wrong reason
  | 'wrong'
  | 'unknown' // "I don't know" or time ran out

export interface AnswerInput {
  /** null when the learner chose "I don't know" or time ran out. */
  correct: boolean | null
  confidence: Confidence | null
  /** null when no "Why?" check was asked. */
  whyCorrect: boolean | null
  elapsedSeconds: number
  minReadSeconds: number
  /** True when this exact wording was answered before. */
  seenBefore: boolean
}

export interface Graded {
  verdict: Verdict
  rating: ReviewRating
  /** Counts toward "knows the concept". */
  counts: boolean
}

export function grade(a: AnswerInput): Graded {
  if (a.correct === null) return { verdict: 'unknown', rating: 1, counts: false }
  if (!a.correct) return { verdict: 'wrong', rating: 1, counts: false }
  if (a.confidence === 'guess') return { verdict: 'guessed', rating: 1, counts: false }
  if (a.whyCorrect === false) return { verdict: 'reason-wrong', rating: 1, counts: false }
  if (a.confidence === 'unsure') return { verdict: 'shaky', rating: 2, counts: true }
  if (a.seenBefore && a.elapsedSeconds < a.minReadSeconds) {
    return { verdict: 'recognized', rating: 2, counts: true }
  }
  return { verdict: 'solid', rating: 3, counts: true }
}

export const verdictLabel: Record<Verdict, string> = {
  solid: msg('Giusta.'),
  shaky: msg('Giusta, ma non eri sicuro.'),
  recognized: msg('Giusta, ma troppo veloce: l’hai riconosciuta, non ragionata.'),
  guessed: msg('Giusta per caso: non conta come saputa.'),
  'reason-wrong': msg('Risposta giusta, motivazione sbagliata: non conta come saputa.'),
  wrong: msg('Sbagliata.'),
  unknown: msg('Non saputa.'),
}
