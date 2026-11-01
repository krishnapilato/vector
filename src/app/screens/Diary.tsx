import { useEffect, useState } from 'react'
import { buildDiary, type DiaryEntry, mistakeLabel } from '../../core/diary'
import { loadAttempts } from '../data/db'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { LinkButton, Page, QuietButton } from '../ui'

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })

/** Every mistake, by concept: what you answered, what was right, and the text to reread. */
export function Diary() {
  const { course } = useStore()
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null)
  const [subject, setSubject] = useState('')
  const [showFixed, setShowFixed] = useState(false)

  useEffect(() => {
    void loadAttempts().then((a) => setEntries(buildDiary(a, course.concepts)))
  }, [course])

  if (!entries) return null
  const visible = entries.filter(
    (e) => (!subject || e.subjectId === subject) && (showFixed || !e.fixed),
  )
  const open = entries.filter((e) => !e.fixed).length

  return (
    <Page title="Diario degli errori">
      <p className="text-[var(--fg-quiet)]">
        {entries.length === 0
          ? 'Nessun errore registrato. Gli errori qui non sono un voto: sono la lista di cosa rileggere.'
          : `${open} ${open === 1 ? 'concetto da sistemare' : 'concetti da sistemare'}. Un concetto si considera sistemato quando, dopo l’errore, lo rispondi capendolo.`}
      </p>
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Materia
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
            >
              <option value="">Tutte</option>
              {course.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={showFixed}
              onChange={(e) => setShowFixed(e.target.checked)}
            />
            Mostra anche quelli sistemati
          </label>
          {subject && (
            <LinkButton href={hrefFor({ name: 'study', subjectId: subject, early: true })}>
              Ripassa questa materia
            </LinkButton>
          )}
        </div>
      )}
      <ul className="flex flex-col">
        {visible.map((e) => (
          <Entry key={e.conceptId} entry={e} />
        ))}
      </ul>
    </Page>
  )
}

function Entry({ entry: e }: { entry: DiaryEntry }) {
  const [open, setOpen] = useState(false)
  const latest = e.mistakes[0]
  return (
    <li className="flex flex-col gap-3 border-t border-[var(--rule)] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">{e.title}</h2>
        <span className="text-sm text-[var(--fg-quiet)]">
          {e.fixed ? 'sistemato · ' : ''}
          {e.mistakes.length} {e.mistakes.length === 1 ? 'errore' : 'errori'} · ultimo{' '}
          {dateFmt.format(new Date(e.lastAt))}
        </span>
      </div>
      {latest && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--fg-quiet)]">Domanda</dt>
          <dd>{latest.prompt}</dd>
          <dt className="text-[var(--fg-quiet)]">{mistakeLabel[latest.verdict] ?? 'Risposta'}</dt>
          <dd>{latest.chosen ?? '—'}</dd>
          <dt className="text-[var(--fg-quiet)]">Giusta</dt>
          <dd>{latest.correct}</dd>
        </dl>
      )}
      <div className="flex flex-wrap gap-1">
        {e.source && (
          <QuietButton onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Nascondi il testo' : 'Rileggi il testo'}
          </QuietButton>
        )}
        {e.subjectId && (
          <a
            href={hrefFor({ name: 'open', subjectId: e.subjectId })}
            className="inline-flex min-h-11 items-center px-3 text-sm text-[var(--fg-quiet)] underline-offset-4 hover:underline"
          >
            Spiegalo a parole
          </a>
        )}
      </div>
      {open && e.source && <p className="max-w-prose leading-relaxed">{e.source}</p>}
    </li>
  )
}
