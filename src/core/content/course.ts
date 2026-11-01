import type { UserConcept } from '../ai/questions'
import { msg } from '../i18n'
import { easaPplSubjects } from './subjects'
import type { Concept, Course, Subject } from './types'

/** Turns a stored, generated concept back into a studyable one. */
export function fromUserConcept(u: UserConcept): Concept {
  return {
    id: u.id,
    subjectId: u.subjectId,
    title: u.title,
    source: u.source,
    variants: u.variants,
    ...(u.why ? { why: u.why } : {}),
    ...(u.keyPoints && u.keyPoints.length > 0 ? { keyPoints: u.keyPoints } : {}),
  }
}

/**
 * What the learner is preparing. The PPL template brings the EASA subjects, a sample course,
 * the radio, weather and flight tools; a custom exam starts empty with the learner's own subjects.
 */
export interface CourseSettings {
  template: 'ppl-easa' | 'custom'
  /** Shown in the app and given to the AI as context, e.g. "Patente nautica". */
  examName: string
  /** Custom exams only. */
  subjects: Subject[]
}

export const pplCourseSettings: CourseSettings = {
  template: 'ppl-easa',
  examName: 'PPL(A) EASA',
  subjects: [],
}

export const isAviation = (c: CourseSettings) => c.template === 'ppl-easa'

/** The course the learner studies: the template plus everything generated from their books. */
export function buildCourse(
  sample: Course,
  userConcepts: readonly UserConcept[],
  includeSample: boolean,
  settings: CourseSettings = pplCourseSettings,
): Course {
  if (settings.template === 'custom') {
    const subjects =
      settings.subjects.length > 0
        ? settings.subjects
        : [{ id: 'general', name: settings.examName }]
    const ids = new Set(subjects.map((s) => s.id))
    const fallback = subjects[0]?.id ?? 'general'
    return {
      id: 'custom',
      name: settings.examName,
      sourceNote: msg(
        'Concetti creati da te e dai tuoi materiali: verificali sempre con le fonti.',
      ),
      subjects,
      concepts: userConcepts.map((u) =>
        fromUserConcept(ids.has(u.subjectId) ? u : { ...u, subjectId: fallback }),
      ),
    }
  }
  return {
    ...sample,
    name: settings.examName || 'PPL(A) EASA',
    subjects: easaPplSubjects,
    concepts: [...(includeSample ? sample.concepts : []), ...userConcepts.map(fromUserConcept)],
  }
}

/** A stable id for a new subject, from its name. */
export function subjectId(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'materia'
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}
