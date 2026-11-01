import type { DefaultSchedulerCard } from 'ts-fsrs'
import type { ReviewRating } from './grading'

/** Thin wrapper around ts-fsrs so the rest of the core never depends on its API directly. */

export type SrsCard = DefaultSchedulerCard

export interface Srs {
  newCard(now: Date): SrsCard
  review(card: SrsCard, rating: ReviewRating, now: Date): SrsCard
}

export async function createSrs(): Promise<Srs> {
  // Loaded on demand: keeps the scheduler out of the startup bundle.
  const { DefaultScheduler } = await import('ts-fsrs')
  const scheduler = await DefaultScheduler({
    desiredRetention: 0.9,
    enableFuzz: false,
    enableShortTerm: true,
  })
  return {
    newCard: (now) => scheduler.newCard({ now }),
    review: (card, rating, now) => scheduler.review({ card, grade: rating, now }).card,
  }
}
