import type { Graded, Verdict } from './grading'
import type { Srs, SrsCard } from './scheduler'

/** What the app knows about the learner, per concept. Only numbers and ids: no content, no media. */
export interface ConceptProgress {
  conceptId: string
  /** null until the concept is first studied. */
  card: SrsCard | null
  /** Per static wording: how often seen and answered right. Generated questions are never tracked. */
  variants: Record<string, { seen: number; correct: number }>
  /** Wordings the learner reported as wrong: never asked again. */
  flagged: string[]
  /** Answers on a wording never seen before: the honest measure of understanding. */
  firstExposure: { n: number; correct: number }
  /** Answers on a wording already seen: can be inflated by memory. */
  repeat: { n: number; correct: number }
  lastVerdict: Verdict | null
}

export type ProgressMap = ReadonlyMap<string, ConceptProgress>

export function emptyProgress(conceptId: string): ConceptProgress {
  return {
    conceptId,
    card: null,
    variants: {},
    flagged: [],
    firstExposure: { n: 0, correct: 0 },
    repeat: { n: 0, correct: 0 },
    lastVerdict: null,
  }
}

export function hasSeen(p: ConceptProgress | undefined, variantId: string, generated: boolean) {
  if (generated || !p) return false
  return (p.variants[variantId]?.seen ?? 0) > 0
}

export interface AnswerRecord {
  variantId: string
  generated: boolean
  seenBefore: boolean
  graded: Graded
  /** Only the first attempt in a session moves the schedule; retries are for learning. */
  updatesSchedule: boolean
}

export function applyAnswer(
  previous: ConceptProgress | undefined,
  conceptId: string,
  answer: AnswerRecord,
  srs: Srs,
  now: Date,
): ConceptProgress {
  const p = previous ?? emptyProgress(conceptId)
  const counts = answer.graded.counts ? 1 : 0

  const variants = { ...p.variants }
  if (!answer.generated) {
    const v = variants[answer.variantId] ?? { seen: 0, correct: 0 }
    variants[answer.variantId] = { seen: v.seen + 1, correct: v.correct + counts }
  }

  const bucket = answer.seenBefore ? 'repeat' : 'firstExposure'
  const card = answer.updatesSchedule
    ? srs.review(p.card ?? srs.newCard(now), answer.graded.rating, now)
    : p.card

  return {
    ...p,
    card,
    variants,
    [bucket]: { n: p[bucket].n + 1, correct: p[bucket].correct + counts },
    lastVerdict: answer.graded.verdict,
  }
}

export function flagVariant(p: ConceptProgress | undefined, conceptId: string, variantId: string) {
  const base = p ?? emptyProgress(conceptId)
  if (base.flagged.includes(variantId)) return base
  return { ...base, flagged: [...base.flagged, variantId] }
}

export type Mastery = 'new' | 'learning' | 'due' | 'consolidated'

/** ts-fsrs State.Review = 2. Seven days of stability is our "consolidated" threshold. */
export function masteryOf(p: ConceptProgress | undefined, now: Date): Mastery {
  if (!p?.card || p.card.reps === 0) return 'new'
  if (p.card.dueAt.getTime() <= now.getTime()) return 'due'
  if (p.card.state === 2 && p.card.stability >= 7) return 'consolidated'
  return 'learning'
}

export const masteryLabel: Record<Mastery, string> = {
  new: 'da iniziare',
  learning: 'in apprendimento',
  due: 'da ripassare',
  consolidated: 'consolidato',
}

export interface Scores {
  /** Share of right answers on never-seen wordings, 0..1, or null with no data. */
  comprehension: number | null
  /** Share of right answers on already-seen wordings. */
  recognition: number | null
  answered: number
}

export function scores(progress: Iterable<ConceptProgress>): Scores {
  let fn = 0
  let fc = 0
  let rn = 0
  let rc = 0
  for (const p of progress) {
    fn += p.firstExposure.n
    fc += p.firstExposure.correct
    rn += p.repeat.n
    rc += p.repeat.correct
  }
  return {
    comprehension: fn === 0 ? null : fc / fn,
    recognition: rn === 0 ? null : rc / rn,
    answered: fn + rn,
  }
}
