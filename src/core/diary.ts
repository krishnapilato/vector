/** The error diary: every mistake, grouped by concept, with whether it has been fixed since. */
import type { Concept } from './content/types'
import type { AttemptLike } from './profile'

export interface DiaryAttempt extends AttemptLike {
  prompt: string
  chosen: string | null
  correct: string
}

export const MISTAKES: readonly string[] = ['wrong', 'unknown', 'reason-wrong', 'guessed']

export const mistakeLabel: Record<string, string> = {
  wrong: 'Sbagliata',
  unknown: 'Non sapevo',
  'reason-wrong': 'Perché sbagliato',
  guessed: 'Indovinata',
}

export interface DiaryEntry {
  conceptId: string
  title: string
  subjectId: string | null
  source: string | null
  mistakes: DiaryAttempt[]
  lastAt: string
  /** The latest answer on this concept, after the last mistake, was understood. */
  fixed: boolean
}

export function buildDiary(
  attempts: readonly DiaryAttempt[],
  concepts: readonly Pick<Concept, 'id' | 'title' | 'subjectId' | 'source'>[],
): DiaryEntry[] {
  const byConcept = new Map<string, DiaryAttempt[]>()
  for (const a of [...attempts].sort((x, y) => x.at.localeCompare(y.at))) {
    const list = byConcept.get(a.conceptId) ?? []
    list.push(a)
    byConcept.set(a.conceptId, list)
  }
  const out: DiaryEntry[] = []
  for (const [conceptId, list] of byConcept) {
    const mistakes = list.filter((a) => MISTAKES.includes(a.verdict))
    const last = mistakes[mistakes.length - 1]
    if (!last) continue
    const c = concepts.find((x) => x.id === conceptId)
    const after = list.filter((a) => a.at > last.at)
    out.push({
      conceptId,
      title: c?.title ?? 'Concetto rimosso',
      subjectId: c?.subjectId ?? null,
      source: c?.source ?? null,
      mistakes: mistakes.reverse(),
      lastAt: last.at,
      fixed:
        after.length > 0 &&
        (after[after.length - 1]?.verdict === 'solid' ||
          after[after.length - 1]?.verdict === 'shaky'),
    })
  }
  return out.sort((a, b) => Number(a.fixed) - Number(b.fixed) || b.lastAt.localeCompare(a.lastAt))
}
