import { masteryOf } from '../../core/progress'
import { coverage } from '../../core/syllabus'
import { t, tn } from '../i18n'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { Page, percent, QuietLink } from '../ui'

/** The EASA programme, topic by topic: what you have material on, and what you know. */
export function ProgramMap({ subjectId }: { subjectId: string | null }) {
  const { course, progress, books } = useStore()
  const now = new Date()
  const isKnown = (id: string) => {
    const m = masteryOf(progress.get(id), now)
    return m === 'consolidated' || (m === 'learning' && progress.get(id)?.lastVerdict === 'solid')
  }
  const subjects = course.subjects.filter((s) => !subjectId || s.id === subjectId)

  return (
    <Page title={t('Programma EASA')}>
      <p className="text-sm text-[var(--fg-quiet)]">
        {t(
          'Gli argomenti del programma PPL(A) (AMC1 FCL.210). Concetti e capitoli sono collegati per parole chiave: è una mappa approssimativa per vedere cosa è ancora scoperto.',
        )}
      </p>
      {subjectId && (
        <QuietLink href={hrefFor({ name: 'map', subjectId: null })}>
          {t('Tutte le materie')}
        </QuietLink>
      )}
      {subjects.map((s) => {
        const topics = coverage(s.id, course.concepts, isKnown, books)
        const blank = topics.filter((t) => t.concepts.length === 0).length
        return (
          <section key={s.id} className="flex flex-col gap-2 border-t border-[var(--rule)] pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">
                <a
                  href={hrefFor({ name: 'map', subjectId: s.id })}
                  className="underline-offset-4 hover:underline"
                >
                  {t(s.name)}
                </a>
              </h2>
              <span className="text-sm text-[var(--fg-quiet)]">
                {blank === 0
                  ? t('tutti gli argomenti hanno materiale')
                  : t('{blank} di {length} senza materiale', { blank, length: topics.length })}
              </span>
            </div>
            <ul className="flex flex-col">
              {topics.map((c) => (
                <li key={c.topic.id} className="flex flex-col gap-1 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className={c.concepts.length === 0 ? 'text-[var(--fg-quiet)]' : ''}>
                      {t(c.topic.title)}
                    </span>
                    <span className="text-sm tabular-nums text-[var(--fg-quiet)]">
                      {c.concepts.length === 0
                        ? t('scoperto')
                        : tn(
                            c.concepts.length,
                            '{n} concetto · {known} saputo',
                            '{n} concetti · {known} saputo',
                            {
                              known: percent(c.known),
                            },
                          )}
                    </span>
                  </div>
                  <div className="h-px w-full bg-[var(--rule)]" aria-hidden="true">
                    <div className="h-px bg-[var(--fg)]" style={{ width: `${c.known * 100}%` }} />
                  </div>
                  {c.chapters.length > 0 && (
                    <p className="text-xs text-[var(--fg-quiet)]">
                      {t('Da leggere:')}{' '}
                      {c.chapters.map((ch, i) => (
                        <span key={`${ch.bookId}-${ch.page}`}>
                          {i > 0 && ' · '}
                          <a
                            href={hrefFor({
                              name: 'reader',
                              bookId: ch.bookId,
                              page: ch.page,
                              view: 'text',
                            })}
                            className="underline underline-offset-4"
                          >
                            {ch.title}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </Page>
  )
}
