import type { UserConcept } from '../ai/questions'
import { easaPplSubjects } from './subjects'
import type { Concept, Course } from './types'

/** Turns a stored, generated concept back into a studyable one. */
export function fromUserConcept(u: UserConcept): Concept {
  return {
    id: u.id,
    subjectId: u.subjectId,
    title: u.title,
    source: u.source,
    variants: u.variants,
    ...(u.why ? { why: u.why } : {}),
  }
}

/** The course the learner studies: the sample course plus everything generated from their books. */
export function buildCourse(
  sample: Course,
  userConcepts: readonly UserConcept[],
  includeSample: boolean,
): Course {
  return {
    ...sample,
    name: 'PPL(A) EASA',
    subjects: easaPplSubjects,
    concepts: [...(includeSample ? sample.concepts : []), ...userConcepts.map(fromUserConcept)],
  }
}
