/**
 * Glossary flashcards with a Leitner schedule: a term known moves to a box reviewed
 * less often; a term missed goes back to the first box. Terms looked up often come first.
 */
import type { GlossaryEntry } from './content/glossary'

export interface CardState {
  term: string
  box: number
  due: string
}

export const BOX_DAYS = [0, 1, 3, 7, 16, 35] as const

export function review(
  prev: CardState | undefined,
  term: string,
  knew: boolean,
  now: Date,
): CardState {
  const box = knew ? Math.min(BOX_DAYS.length - 1, (prev?.box ?? 0) + 1) : 0
  const due = new Date(now.getTime() + (BOX_DAYS[box] ?? 0) * 86_400_000)
  return { term, box, due: due.toISOString() }
}

export type Direction = 'it-en' | 'en-it'

export interface Card {
  entry: GlossaryEntry
  direction: Direction
  front: string
  back: string
}

/** Up to `n` cards: due ones first, then terms the learner looked up most, then new ones. */
export function pickCards(
  entries: readonly GlossaryEntry[],
  states: ReadonlyMap<string, CardState>,
  lookups: ReadonlyMap<string, number>,
  now: Date,
  n: number,
  flip: () => boolean,
): Card[] {
  const score = (e: GlossaryEntry) => {
    const s = states.get(e.en)
    const looked = (lookups.get(e.en.toLowerCase()) ?? 0) + (lookups.get(e.it.toLowerCase()) ?? 0)
    if (s && new Date(s.due) > now) return -1
    if (s) return 1000 - s.box * 100 + looked
    return 500 + looked * 10
  }
  return entries
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(({ e }) => {
      const direction: Direction = flip() ? 'en-it' : 'it-en'
      return {
        entry: e,
        direction,
        front: direction === 'it-en' ? e.it : e.en,
        back: direction === 'it-en' ? e.en : e.it,
      }
    })
}
