import type { QuestionKind } from '../question-timer'
import { type Rng, shuffle } from '../random'
import { type Concept, isGenerated, type Variant } from './types'

export interface Option {
  id: string
  text: string
}

/** A question ready to show: serializable, so a session can be saved and resumed. */
export interface Question {
  conceptId: string
  variantId: string
  generated: boolean
  kind: QuestionKind
  prompt: string
  options: Option[]
  correctOptionId: string
  explanation: string
  why: { options: Option[]; correctOptionId: string } | null
}

const OPTION_IDS = ['a', 'b', 'c', 'd'] as const

/** Builds a question: draws 3 distractors from the pool and shuffles everything. */
export function buildQuestion(
  concept: Concept,
  variant: Variant,
  rng: Rng,
  askWhy: boolean,
): Question {
  const base = isGenerated(variant) ? variant.generate(rng) : variant
  const distractors = shuffle(rng, [...new Set(base.distractors)])
    .filter((d) => d !== base.answer)
    .slice(0, 3)
  if (distractors.length < 3) {
    throw new Error(`Variant ${variant.id} needs at least 3 distinct distractors`)
  }
  const texts = shuffle(rng, [base.answer, ...distractors])
  const options = texts.map((text, i) => ({ id: OPTION_IDS[i] as string, text }))
  const correct = options.find((o) => o.text === base.answer) as Option

  let why: Question['why'] = null
  if (askWhy && concept.why) {
    const wrong = shuffle(rng, concept.why.wrong).slice(0, 2)
    const whyTexts = shuffle(rng, [concept.why.correct, ...wrong])
    const whyOptions = whyTexts.map((text, i) => ({ id: OPTION_IDS[i] as string, text }))
    why = {
      options: whyOptions,
      correctOptionId: (whyOptions.find((o) => o.text === concept.why?.correct) as Option).id,
    }
  }

  return {
    conceptId: concept.id,
    variantId: variant.id,
    generated: isGenerated(variant),
    kind: variant.kind,
    prompt: base.prompt,
    options,
    correctOptionId: correct.id,
    explanation: base.explanation,
    why,
  }
}

/** Minimum time to actually read a question (≈ 400 words per minute, at least 1.5 s). */
export function minReadSeconds(q: Pick<Question, 'prompt' | 'options'>): number {
  const words = [q.prompt, ...q.options.map((o) => o.text)].join(' ').split(/\s+/).length
  return Math.max(1.5, words * 0.15)
}
