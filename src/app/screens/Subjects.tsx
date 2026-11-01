import { useId, useState } from 'react'
import type { UserConcept } from '../../core/ai/questions'
import { subjectId } from '../../core/content/course'
import type { Subject } from '../../core/content/types'
import { type Mastery, masteryLabel, masteryOf } from '../../core/progress'
import { t } from '../i18n'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { LinkButton, Page, QuietButton, QuietLink } from '../ui'

const order: Mastery[] = ['due', 'learning', 'new', 'consolidated']

export function Subjects({ subjectId }: { subjectId: string | null }) {
  const { course, progress, userConcepts, exam } = useStore()
  const now = new Date()
  const subject = course.subjects.find((s) => s.id === subjectId)

  if (!subject) {
    return (
      <Page title={t('Materie')}>
        <div className="flex flex-wrap gap-6">
          {exam.aviation && (
            <QuietLink href={hrefFor({ name: 'map', subjectId: null })}>
              {t('Programma EASA')}
            </QuietLink>
          )}
          <QuietLink href={hrefFor({ name: 'diary' })}>{t('Diario degli errori')}</QuietLink>
        </div>
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
                  <span className="text-lg">{t(s.name)}</span>
                  <span className="text-sm text-[var(--fg-quiet)]">
                    {done} {t('di')} {concepts.length} {t('consolidati')}
                    {due > 0 ? t(' · {due} da ripassare', { due }) : ''}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        {!exam.aviation && <SubjectEditor />}
        <p className="text-xs text-[var(--fg-quiet)]">{t(course.sourceNote)}</p>
      </Page>
    )
  }

  const concepts = course.concepts
    .filter((c) => c.subjectId === subject.id)
    .map((c) => ({ concept: c, mastery: masteryOf(progress.get(c.id), now) }))
    .sort((a, b) => order.indexOf(a.mastery) - order.indexOf(b.mastery))

  return (
    <Page title={t(subject.name)}>
      <div className="flex flex-wrap items-center gap-6">
        <LinkButton href={hrefFor({ name: 'study', subjectId: subject.id, early: true })}>
          {t('Studia questa materia')}
        </LinkButton>
        <QuietLink href={hrefFor({ name: 'open', subjectId: subject.id })}>
          {t('Spiega a parole')}
        </QuietLink>
        {exam.aviation && (
          <QuietLink href={hrefFor({ name: 'map', subjectId: subject.id })}>
            {t('Programma')}
          </QuietLink>
        )}
        <QuietLink href={hrefFor({ name: 'subjects', subjectId: null })}>
          {t('Tutte le materie')}
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
                {t(masteryLabel[mastery])}
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
        {t('Creato con l’IA da')} {o.bookTitle}
        {t(', pagine')} {o.fromPage}–{o.toPage}
      </a>
      {armed ? (
        <>
          <QuietButton
            className="text-[var(--fg)] underline"
            onClick={() => removeConcept(concept.id)}
          >
            {t('Conferma eliminazione')}
          </QuietButton>
          <QuietButton onClick={() => setArmed(false)}>{t('Annulla')}</QuietButton>
        </>
      ) : (
        <QuietButton onClick={() => setArmed(true)}>{t('Elimina')}</QuietButton>
      )}
    </div>
  )
}

/** Custom exams: the learner's own subjects. A subject with concepts can't be removed. */
function SubjectEditor() {
  const { prefs, updatePrefs, course } = useStore()
  const [name, setName] = useState('')
  const id = useId()
  const subjects = prefs.course.subjects
  const save = (next: Subject[]) =>
    updatePrefs({ ...prefs, course: { ...prefs.course, subjects: next } })

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--rule)] pt-6">
      <h2 className="text-lg font-medium">{t('Le tue materie')}</h2>
      {subjects.length === 0 && (
        <p className="text-sm text-[var(--fg-quiet)]">
          {t(
            'Aggiungi le materie del tuo esame: le domande create dai libri verranno assegnate a queste.',
          )}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {subjects.map((s) => {
          const used = course.concepts.some((c) => c.subjectId === s.id)
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={t('Nome della materia')}
                defaultValue={s.name}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== s.name)
                    void save(subjects.map((x) => (x.id === s.id ? { ...x, name: v } : x)))
                }}
                className="min-h-11 flex-1 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
              />
              <QuietButton
                disabled={used}
                title={used ? t('Ha dei concetti: eliminali prima') : undefined}
                onClick={() => void save(subjects.filter((x) => x.id !== s.id))}
              >
                {t('Rimuovi')}
              </QuietButton>
            </li>
          )
        })}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const v = name.trim()
          if (!v) return
          void save([
            ...subjects,
            { id: subjectId(v, new Set(subjects.map((x) => x.id))), name: v },
          ])
          setName('')
        }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={id} className="text-sm">
            {t('Nuova materia')}
          </label>
          <input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className="min-h-11 rounded-lg border border-[var(--fg)] px-4 text-sm disabled:opacity-40"
        >
          {t('Aggiungi')}
        </button>
      </form>
    </section>
  )
}
