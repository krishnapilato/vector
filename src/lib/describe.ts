/** How a block reads in the interface: a title and the concrete content. */
import type { Block, Chapter, Exercise, SimLesson } from '../core/model/schemas'
import { copy } from './copy'

export interface Catalogue {
  chapters: readonly Chapter[]
  exercises: readonly Exercise[]
  simLessons: readonly SimLesson[]
}

export interface Described {
  title: string
  detail: string
  lesson: SimLesson | null
  chapter: Chapter | null
}

export function describeBlock(block: Block, catalogue: Catalogue): Described {
  const ref = block.ref
  const chapter =
    ref?.type === 'chapter' ? (catalogue.chapters.find((c) => c.id === ref.id) ?? null) : null
  if (block.kind === 'exercise') {
    const exercise =
      ref?.type === 'exercise' ? catalogue.exercises.find((e) => e.id === ref.id) : undefined
    return {
      title: exercise?.title ?? block.content,
      detail: exercise?.source ?? '',
      lesson: null,
      chapter: null,
    }
  }
  if (block.kind === 'simulator') {
    const lesson =
      ref?.type === 'sim' ? (catalogue.simLessons.find((l) => l.id === ref.id) ?? null) : null
    return {
      title: `MSFS · ${lesson?.title ?? block.content}`,
      detail: lesson?.tolerances.join(' · ') ?? '',
      lesson,
      chapter: null,
    }
  }
  return {
    title: copy.block.title(block.kind, chapter?.order ?? null, chapter?.title ?? null),
    detail: block.content,
    lesson: null,
    chapter,
  }
}
