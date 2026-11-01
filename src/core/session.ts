import type { Config } from '../config/config'
import { buildQuestion, type Question } from './content/question'
import { type Concept, type Course, isGenerated, type Variant } from './content/types'
import type { Confidence, Verdict } from './grading'
import { hasSeen, type ProgressMap } from './progress'
import type { StudyMode } from './question-timer'
import { pick, type Rng, shuffle } from './random'

export interface StudySettings {
  mode: Extract<StudyMode, 'understand' | 'practice'>
  sessionLength: number
  newConcepts: number
  fullscreen: boolean
  /** Include the hand-written sample course alongside the learner's own material. */
  includeSample: boolean
  /** Reading text size step, 0 (small) to 3 (very large). */
  readingSize: number
  /** Adapt AI explanations to the learner's study patterns (sent as short neutral notes). */
  personalize: boolean
  /** The learner accepted that browser dictation may send audio to the browser vendor. */
  voiceConsent: boolean
}

export function defaultSettings(config: Config): StudySettings {
  return {
    mode: 'practice',
    sessionLength: config.session.length,
    newConcepts: config.session.newConcepts,
    fullscreen: true,
    includeSample: true,
    readingSize: 1,
    personalize: true,
    voiceConsent: false,
  }
}

export interface ItemResult {
  chosenOptionId: string | null
  confidence: Confidence | null
  whyOptionId: string | null
  elapsedSeconds: number
  verdict: Verdict
}

export interface SessionItem {
  question: Question
  seenBefore: boolean
  attempt: 1 | 2
  result: ItemResult | null
}

export interface Session {
  id: string
  createdAt: string
  mode: StudySettings['mode']
  subjectId: string | null
  items: SessionItem[]
  index: number
  interruptions: number
}

/** Prefer a wording never seen (generated questions always count as new); else the least seen. */
export function pickVariant(
  concept: Concept,
  progress: ProgressMap,
  rng: Rng,
  exclude: string | null = null,
): Variant {
  const p = progress.get(concept.id)
  const usable = concept.variants.filter(
    (v) => !p?.flagged.includes(v.id) && (v.id !== exclude || concept.variants.length === 1),
  )
  const pool = usable.length > 0 ? usable : concept.variants
  const fresh = pool.filter((v) => isGenerated(v) || !hasSeen(p, v.id, false))
  if (fresh.length > 0) return pick(rng, fresh)
  const seen = (v: Variant) => p?.variants[v.id]?.seen ?? 0
  const least = Math.min(...pool.map(seen))
  return pick(
    rng,
    pool.filter((v) => seen(v) === least),
  )
}

function makeItem(
  concept: Concept,
  progress: ProgressMap,
  rng: Rng,
  config: Config,
  attempt: 1 | 2,
  exclude: string | null = null,
): SessionItem {
  const variant = pickVariant(concept, progress, rng, exclude)
  const seenBefore = hasSeen(progress.get(concept.id), variant.id, isGenerated(variant))
  // Always ask "Why?" on a repeated wording (it may be memorized), sometimes otherwise.
  const askWhy = seenBefore || rng() < config.quiz.whyProbability
  return {
    question: buildQuestion(concept, variant, rng, askWhy),
    seenBefore,
    attempt,
    result: null,
  }
}

export interface BuildOptions {
  course: Course
  progress: ProgressMap
  settings: StudySettings
  config: Config
  rng: Rng
  now: Date
  id: string
  subjectId?: string | null
  /** Study even if nothing is due: picks the concepts due soonest. */
  early?: boolean
}

/** Due concepts first, then a few new ones, interleaved across subjects. Null when there is nothing to do. */
export function buildSession(o: BuildOptions): Session | null {
  const concepts = o.course.concepts.filter((c) => !o.subjectId || c.subjectId === o.subjectId)
  const card = (c: Concept) => o.progress.get(c.id)?.card ?? null

  const due = concepts
    .filter((c) => {
      const k = card(c)
      return k !== null && k.dueAt.getTime() <= o.now.getTime()
    })
    .sort((a, b) => (card(a)?.dueAt.getTime() ?? 0) - (card(b)?.dueAt.getTime() ?? 0))
  const fresh = concepts.filter((c) => card(c) === null).slice(0, o.settings.newConcepts)

  let chosen = [...due, ...fresh].slice(0, o.settings.sessionLength)
  if (chosen.length === 0 && o.early) {
    chosen = concepts
      .filter((c) => card(c) !== null)
      .sort((a, b) => (card(a)?.dueAt.getTime() ?? 0) - (card(b)?.dueAt.getTime() ?? 0))
      .slice(0, o.settings.sessionLength)
  }
  if (chosen.length === 0) return null

  return {
    id: o.id,
    createdAt: o.now.toISOString(),
    mode: o.settings.mode,
    subjectId: o.subjectId ?? null,
    items: shuffle(o.rng, chosen).map((c) => makeItem(c, o.progress, o.rng, o.config, 1)),
    index: 0,
    interruptions: 0,
  }
}

/** When the next study session will have something due, for the "all caught up" screen. */
export function nextDue(course: Course, progress: ProgressMap): Date | null {
  let next: Date | null = null
  for (const c of course.concepts) {
    const due = progress.get(c.id)?.card?.dueAt
    if (due && (!next || due < next)) next = due
  }
  return next
}

export function currentItem(s: Session): SessionItem | null {
  return s.items[s.index] ?? null
}

export function isFinished(s: Session): boolean {
  return s.index >= s.items.length
}

/**
 * Stores the result. A first attempt that does not count comes back later in the
 * session with a different wording, a few questions on, never right away.
 */
export function recordResult(
  s: Session,
  result: ItemResult,
  counts: boolean,
  retry: { course: Course; progress: ProgressMap; rng: Rng; config: Config },
): Session {
  const item = s.items[s.index]
  if (!item || item.result) return s
  const items = [...s.items]
  items[s.index] = { ...item, result }

  if (!counts && item.attempt === 1) {
    const concept = retry.course.concepts.find((c) => c.id === item.question.conceptId)
    if (concept) {
      const again = makeItem(
        concept,
        retry.progress,
        retry.rng,
        retry.config,
        2,
        item.question.variantId,
      )
      items.splice(Math.min(s.index + 4, items.length), 0, again)
    }
  }
  return { ...s, items }
}

export function advance(s: Session): Session {
  return { ...s, index: s.index + 1 }
}

export function addInterruption(s: Session): Session {
  return { ...s, interruptions: s.interruptions + 1 }
}

export interface Summary {
  total: number
  known: number
  toReview: string[]
  interruptions: number
}

/** First attempts only: retries teach, they don't score. */
export function summarize(s: Session, course: Course): Summary {
  const first = s.items.filter((i) => i.attempt === 1 && i.result)
  const counting: Verdict[] = ['solid', 'shaky', 'recognized']
  const missed = first.filter((i) => i.result && !counting.includes(i.result.verdict))
  const title = (id: string) => course.concepts.find((c) => c.id === id)?.title ?? id
  return {
    total: first.length,
    known: first.length - missed.length,
    toReview: [...new Set(missed.map((i) => title(i.question.conceptId)))],
    interruptions: s.interruptions,
  }
}

/** "I have N minutes": how many questions fit, from the learner's typical pace when known. */
export function questionsForMinutes(minutes: number, medianSeconds: number | null): number {
  // Answer time plus reading the feedback; never assume the learner is faster than 20 s.
  const perQuestion = medianSeconds && medianSeconds > 0 ? Math.max(20, medianSeconds + 15) : 45
  return Math.min(40, Math.max(3, Math.round((minutes * 60) / perQuestion)))
}
