/**
 * What Vector has learned about how the learner studies, computed from their own
 * history on this device. Neutral facts, no judgement, no inference about the person.
 */
import type { Course } from './content/types'
import type { Verdict } from './grading'

export interface AttemptLike {
  at: string
  conceptId: string
  variantId: string
  verdict: string
  elapsedSeconds: number
  seenBefore: boolean
}

export interface FocusLike {
  endedAt: string
  seconds: number
  attentiveSeconds: number
  phoneSeen: number
  leftApp: number
}

export interface SubjectStats {
  subjectId: string
  name: string
  attempts: number
  /** Share of answers that count as known (solid or shaky). */
  understood: number
}

export interface KindStats {
  kind: 'recall' | 'reasoning' | 'calculation' | 'open'
  attempts: number
  understood: number
}

export interface Profile {
  attempts: number
  understood: number
  /** Share of correct answers on seen wordings that were too fast to be read. */
  recognized: number
  /** Right answers given with "guess" or wrong reasoning. */
  lucky: number
  medianSeconds: number
  subjects: SubjectStats[]
  kinds: KindStats[]
  /** Concepts answered wrong most often. */
  hardest: { conceptId: string; title: string; misses: number }[]
  /** Accuracy by part of the day, only parts with enough answers. */
  dayParts: { part: DayPart; attempts: number; understood: number }[]
  focus: { sessions: number; score: number | null; recentScores: number[]; phoneSessions: number }
  topLookups: { term: string; count: number }[]
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'
export const dayPartLabel: Record<DayPart, string> = {
  morning: 'mattina',
  afternoon: 'pomeriggio',
  evening: 'sera',
  night: 'notte',
}

const KNOWN: readonly string[] = ['solid', 'shaky'] satisfies Verdict[]

export function dayPart(date: Date): DayPart {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 23) return 'evening'
  return 'night'
}

const share = (n: number, d: number) => (d === 0 ? 0 : n / d)

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

export function buildProfile(
  attempts: readonly AttemptLike[],
  focus: readonly FocusLike[],
  lookups: readonly { term: string; count: number }[],
  course: Pick<Course, 'subjects' | 'concepts'>,
): Profile {
  const conceptById = new Map(course.concepts.map((c) => [c.id, c]))
  const kindOf = (a: AttemptLike) =>
    conceptById.get(a.conceptId)?.variants.find((v) => v.id === a.variantId)?.kind ?? 'recall'
  const known = (a: AttemptLike) => KNOWN.includes(a.verdict)

  const subjects = course.subjects
    .map((s) => {
      const xs = attempts.filter((a) => conceptById.get(a.conceptId)?.subjectId === s.id)
      return {
        subjectId: s.id,
        name: s.name,
        attempts: xs.length,
        understood: share(xs.filter(known).length, xs.length),
      }
    })
    .filter((s) => s.attempts > 0)
    .sort((a, b) => a.understood - b.understood)

  const kinds = (['recall', 'reasoning', 'calculation', 'open'] as const)
    .map((kind) => {
      const xs = attempts.filter((a) => kindOf(a) === kind)
      return { kind, attempts: xs.length, understood: share(xs.filter(known).length, xs.length) }
    })
    .filter((k) => k.attempts > 0)

  const misses = new Map<string, number>()
  for (const a of attempts) {
    if (a.verdict === 'wrong' || a.verdict === 'unknown' || a.verdict === 'reason-wrong')
      misses.set(a.conceptId, (misses.get(a.conceptId) ?? 0) + 1)
  }
  const hardest = [...misses]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([conceptId, n]) => ({
      conceptId,
      title: conceptById.get(conceptId)?.title ?? 'Concetto rimosso',
      misses: n,
    }))

  const dayParts = (['morning', 'afternoon', 'evening', 'night'] as const)
    .map((part) => {
      const xs = attempts.filter((a) => dayPart(new Date(a.at)) === part)
      return { part, attempts: xs.length, understood: share(xs.filter(known).length, xs.length) }
    })
    .filter((d) => d.attempts >= 10)

  const sessions = [...focus].sort((a, b) => a.endedAt.localeCompare(b.endedAt))
  const totalSeconds = sessions.reduce((n, f) => n + f.seconds, 0)
  const attentive = sessions.reduce((n, f) => n + f.attentiveSeconds, 0)

  const seen = attempts.filter(
    (a) => a.seenBefore && a.verdict !== 'wrong' && a.verdict !== 'unknown',
  )
  return {
    attempts: attempts.length,
    understood: share(attempts.filter(known).length, attempts.length),
    recognized: share(seen.filter((a) => a.verdict === 'recognized').length, seen.length),
    lucky: share(
      attempts.filter((a) => a.verdict === 'guessed' || a.verdict === 'reason-wrong').length,
      attempts.length,
    ),
    medianSeconds: median(attempts.map((a) => a.elapsedSeconds)),
    subjects,
    kinds,
    hardest,
    dayParts,
    focus: {
      sessions: sessions.length,
      score: totalSeconds > 0 ? attentive / totalSeconds : null,
      recentScores: sessions.slice(-10).map((f) => share(f.attentiveSeconds, f.seconds)),
      phoneSessions: sessions.filter((f) => f.phoneSeen > 0).length,
    },
    topLookups: [...lookups].sort((a, b) => b.count - a.count).slice(0, 8),
  }
}

/**
 * Short, neutral notes that adapt how explanations are written. They describe study
 * patterns, never the person, and are only sent with an explanation request.
 */
export function profileHints(p: Profile): string[] {
  if (p.attempts < 20) return []
  const hints: string[] = []
  const reasoning = p.kinds.find((k) => k.kind === 'reasoning')
  const recall = p.kinds.find((k) => k.kind === 'recall')
  const calc = p.kinds.find((k) => k.kind === 'calculation')
  if (
    reasoning &&
    recall &&
    reasoning.attempts >= 5 &&
    reasoning.understood + 0.15 < recall.understood
  )
    hints.push(
      'Ricorda bene le definizioni ma fatica ad applicarle: parti da una situazione di volo concreta.',
    )
  if (calc && calc.attempts >= 5 && calc.understood < 0.6)
    hints.push('Sbaglia spesso i calcoli: mostra i passaggi uno per uno con le unità di misura.')
  if (p.recognized > 0.25)
    hints.push(
      'Tende a riconoscere le domande invece di ragionare: spiega il perché, non solo il cosa.',
    )
  if (p.lucky > 0.2)
    hints.push('Spesso indovina: evidenzia il ragionamento che porta alla risposta.')
  const weakest = p.subjects[0]
  if (weakest && weakest.attempts >= 10 && weakest.understood < 0.5)
    hints.push(`La materia più difficile per lo studente è ${weakest.name}.`)
  return hints
}
