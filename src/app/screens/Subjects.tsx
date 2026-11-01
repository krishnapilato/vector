import { useState } from 'react'
import type { UserConcept } from '../../core/ai/questions'
import { type Mastery, masteryLabel, masteryOf } from '../../core/progress'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { LinkButton, Page, QuietButton, QuietLink } from '../ui'

const order: Mastery[] = ['due', 'learning', 'new', 'consolidated']

export function Subjects({ subjectId }: { subjectId: string | null }) {
  const { course, progress, userConcepts } = useStore()
  const now = new Date()
  const subject = course.subjects.find((s) => s.id === subjectId)

  if (!subject) {
    return (
      <Page title="Materie">
        <ul className="flex flex-col">
          {course.subjects.map((s) => {
            const concepts = course.concepts.filter((c) => c.subjectId === s.id)
            const done = concepts.filter(
              (c) => masteryOf(progress.get(c.id), now) === 'consolidated',
            ).length
            const due = concepts.filter((c) => masteryOf(progress.get(c.id), now) === 'due').length
            return (
              <li key={s.id} className="border-t border-[var(--rule)]">
                <a
                  href={hrefFor({ name: 'subjects', subjectId: s.id })}
                  className="flex min-h-16 items-center justify-between gap-4 py-4"
                >
                  <span className="text-lg">{s.name}</span>
                  <span className="text-sm text-[var(--fg-quiet)]">
                    {done} di {concepts.length} consolidati{due > 0 ? ` · ${due} da ripassare` : ''}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-[var(--fg-quiet)]">{course.sourceNote}</p>
      </Page>
    )
  }

  const concepts = course.concepts
    .filter((c) => c.subjectId === subject.id)
    .map((c) => ({ concept: c, mastery: masteryOf(progress.get(c.id), now) }))
    .sort((a, b) => order.indexOf(a.mastery) - order.indexOf(b.mastery))

  return (
    <Page title={subject.name}>
      <div className="flex flex-wrap items-center gap-6">
        <LinkButton href={hrefFor({ name: 'study', subjectId: subject.id, early: true })}>
          Studia questa materia
        </LinkButton>
        <QuietLink href={hrefFor({ name: 'subjects', subjectId: null })}>
          Tutte le materie
        </QuietLink>
      </div>
      <div className="flex flex-col">
        {concepts.map(({ concept, mastery }) => (
          <article
            key={concept.id}
            className="flex flex-col gap-3 border-t border-[var(--rule)] py-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{concept.title}</h2>
              <span
                className={`text-sm ${mastery === 'due' ? 'text-[var(--fg)] underline underline-offset-4' : 'text-[var(--fg-quiet)]'}`}
              >
                {masteryLabel[mastery]}
              </span>
            </div>
            <p className="max-w-prose leading-relaxed">{concept.source}</p>
            <Origin concept={userConcepts.find((u) => u.id === concept.id)} />
          </article>
        ))}
      </div>
    </Page>
  )
}

/** Generated concepts show where they come from and can be removed. */
function Origin({ concept }: { concept: UserConcept | undefined }) {
  const { removeConcept } = useStore()
  const [armed, setArmed] = useState(false)
  if (!concept) return null
  const o = concept.origin
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--fg-quiet)]">
      <a
        href={hrefFor({ name: 'reader', bookId: o.bookId, page: o.fromPage, view: 'text' })}
        className="underline-offset-4 hover:underline"
      >
        Creato con l’IA da {o.bookTitle}, pagine {o.fromPage}–{o.toPage}
      </a>
      {armed ? (
        <>
          <QuietButton
            className="text-[var(--fg)] underline"
            onClick={() => removeConcept(concept.id)}
          >
            Conferma eliminazione
          </QuietButton>
          <QuietButton onClick={() => setArmed(false)}>Annulla</QuietButton>
        </>
      ) : (
        <QuietButton onClick={() => setArmed(true)}>Elimina</QuietButton>
      )}
    </div>
  )
}
