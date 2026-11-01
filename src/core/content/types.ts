import type { QuestionKind } from '../question-timer'
import type { Rng } from '../random'

/**
 * Content model: subject → concept → variants.
 * The unit of study is the CONCEPT; variants are different ways of asking it,
 * so the learner never sees the same wording often enough to memorize it.
 */

export interface Subject {
  id: string
  name: string
}

/** A hand-written question. One correct answer, a pool of plausible distractors. */
export interface StaticVariant {
  id: string
  kind: QuestionKind
  prompt: string
  answer: string
  /** At least 3; three are drawn at random each time. */
  distractors: readonly string[]
  explanation: string
}

/** A question built by code with fresh numbers each time: impossible to memorize. */
export interface GeneratedVariant {
  id: string
  kind: QuestionKind
  generate: (rng: Rng) => Omit<StaticVariant, 'id' | 'kind'>
}

export type Variant = StaticVariant | GeneratedVariant

/** The "Why?" check asked after some correct answers. */
export interface WhyCheck {
  correct: string
  wrong: readonly string[]
}

export interface Concept {
  id: string
  subjectId: string
  title: string
  /** The paragraph the questions come from: shown again after a mistake. */
  source: string
  variants: readonly Variant[]
  why?: WhyCheck
}

export interface Course {
  id: string
  name: string
  /** Shown in the app so the learner knows how far to trust it. */
  sourceNote: string
  subjects: readonly Subject[]
  concepts: readonly Concept[]
}

export function isGenerated(v: Variant): v is GeneratedVariant {
  return 'generate' in v
}
