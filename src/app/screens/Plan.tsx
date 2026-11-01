import { useId, useState } from 'react'
import {
  addDays,
  itemsOn,
  type PlanItem,
  type PlanKind,
  planKindLabel,
  readiness,
  repeatWeekly,
  sameDay,
  startOfWeek,
  toIcs,
  weekDays,
} from '../../core/plan'
import { masteryOf } from '../../core/progress'
import { locale, t, tn } from '../i18n'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { LinkButton, Page, PrimaryButton, QuietButton } from '../ui'

const dayFmt = () =>
  new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = () => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' })
const rangeFmt = () => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' })

const inputClass =
  'min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3 text-[var(--fg)]'

/** YYYY-MM-DD in local time, for <input type="date">. */
function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function Plan() {
  const { plan, course, progress, prefs, updatePrefs, removePlan, savePlan, focusLog } = useStore()
  const [weekOf, setWeekOf] = useState(() => startOfWeek(new Date()))
  const today = new Date()
  const days = weekDays(weekOf)
  const subjectName = (id: string) => course.subjects.find((s) => s.id === id)?.name ?? id

  const examDate = prefs.plan.examDate ? new Date(`${prefs.plan.examDate}T00:00:00`) : null
  const notStarted = course.concepts.filter(
    (c) => masteryOf(progress.get(c.id), today) === 'new',
  ).length
  const ready = examDate ? readiness(examDate, today, notStarted) : null

  const weekMinutes = focusLog
    .filter((e) => {
      const d = new Date(e.endedAt)
      return d >= weekOf && d < addDays(weekOf, 7)
    })
    .reduce((s, e) => s + e.minutes, 0)

  const exportIcs = () => {
    const upcoming = plan.filter((i) => new Date(i.start) >= addDays(today, -1))
    const blob = new Blob([toIcs(upcoming, subjectName, new Date())], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'vector-piano.ics'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const examId = useId()

  return (
    <Page title={t('Piano')}>
      <section className="flex flex-col gap-3">
        <label htmlFor={examId} className="text-sm">
          {t("Data dell'esame teorico")}
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <input
            id={examId}
            type="date"
            value={prefs.plan.examDate ?? ''}
            min={isoDay(today)}
            onChange={(e) => updatePrefs({ ...prefs, plan: { examDate: e.target.value || null } })}
            className={`${inputClass} max-w-52`}
          />
          {ready && ready.daysLeft > 0 && (
            <p>
              {t('Mancano')}{' '}
              <strong className="font-medium">
                {ready.daysLeft} {t('giorni')}
              </strong>
              .
            </p>
          )}
        </div>
        {ready && ready.daysLeft > 0 && ready.notStarted > 0 && ready.newPerDay !== null && (
          <p className="text-sm text-[var(--fg-quiet)]">
            {tn(
              ready.newPerDay,
              '{left} concetti ancora da iniziare: circa {n} nuovo al giorno',
              '{left} concetti ancora da iniziare: circa {n} nuovi al giorno',
              {
                left: ready.notStarted,
              },
            )}
            {ready.daysLeft > 28 ? t(', tenendo le ultime due settimane per il ripasso') : ''}
            {t('. Lo imposti in Impostazioni → Concetti nuovi per sessione.')}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-[var(--rule)] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">
            {rangeFmt().format(weekOf)} – {rangeFmt().format(addDays(weekOf, 6))}
          </h2>
          <div className="flex items-center gap-1">
            <QuietButton onClick={() => setWeekOf(addDays(weekOf, -7))}>
              {t('‹ Settimana prima')}
            </QuietButton>
            <QuietButton onClick={() => setWeekOf(startOfWeek(new Date()))}>
              {t('Oggi')}
            </QuietButton>
            <QuietButton onClick={() => setWeekOf(addDays(weekOf, 7))}>
              {t('Settimana dopo ›')}
            </QuietButton>
          </div>
        </div>
        {weekMinutes > 0 && (
          <p className="text-sm text-[var(--fg-quiet)]">
            {t('Concentrazione registrata questa settimana:')} {Math.floor(weekMinutes / 60)}{' '}
            {t('h')} {weekMinutes % 60} {t('min.')}
          </p>
        )}
        <ol className="flex flex-col">
          {days.map((day) => {
            const items = itemsOn(plan, day)
            const isToday = sameDay(day, today)
            const isExam = examDate !== null && sameDay(day, examDate)
            return (
              <li key={day.toISOString()} className="border-t border-[var(--rule)] py-3">
                <h3
                  className={`text-sm ${isToday ? 'font-medium underline underline-offset-4' : ''}`}
                >
                  {dayFmt().format(day)}
                  {isToday && t(' · oggi')}
                  {isExam && t(' · ESAME')}
                </h3>
                {items.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((i) => (
                      <PlanRow
                        key={i.id}
                        item={i}
                        subjectName={subjectName}
                        onToggle={() => savePlan([{ ...i, done: !i.done }])}
                        onDelete={() => removePlan(i.id)}
                      />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <AddSession defaultDay={sameDay(weekOf, startOfWeek(today)) ? today : weekOf} />

      <section className="flex flex-wrap items-center gap-6 border-t border-[var(--rule)] pt-6">
        <LinkButton href={hrefFor({ name: 'pomodoro' })}>{t('Avvia un pomodoro')}</LinkButton>
        <QuietButton onClick={exportIcs} disabled={plan.length === 0}>
          {t('Esporta per Google Calendar (.ics)')}
        </QuietButton>
      </section>
    </Page>
  )
}

function PlanRow({
  item,
  subjectName,
  onToggle,
  onDelete,
}: {
  item: PlanItem
  subjectName: (id: string) => string
  onToggle: () => void
  onDelete: () => void
}) {
  const start = new Date(item.start)
  const label = [
    timeFmt().format(start),
    `${item.minutes} min`,
    t(planKindLabel[item.kind]),
    item.subjectId ? subjectName(item.subjectId) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const studyHref =
    item.kind === 'exam-sim'
      ? hrefFor({ name: 'study', subjectId: null, early: true })
      : hrefFor({ name: 'study', subjectId: item.subjectId, early: item.kind === 'study' })
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span className={item.done ? 'text-[var(--fg-quiet)] line-through' : ''}>{label}</span>
      <span className="flex items-center gap-1">
        {!item.done && (
          <a
            href={studyHref}
            className="inline-flex min-h-11 items-center px-3 text-sm underline underline-offset-4"
          >
            {t('Inizia')}
          </a>
        )}
        <QuietButton onClick={onToggle}>{item.done ? t('Da fare') : 'Fatto'}</QuietButton>
        <QuietButton onClick={onDelete} aria-label={t('Elimina {label}', { label })}>
          {t('Elimina')}
        </QuietButton>
      </span>
    </li>
  )
}

function AddSession({ defaultDay }: { defaultDay: Date }) {
  const { course, savePlan } = useStore()
  const [date, setDate] = useState(isoDay(defaultDay))
  const [time, setTime] = useState('18:30')
  const [minutes, setMinutes] = useState(45)
  const [kind, setKind] = useState<PlanKind>('study')
  const [subjectId, setSubjectId] = useState('')
  const [weeks, setWeeks] = useState(1)
  const [added, setAdded] = useState<string | null>(null)
  const ids = {
    date: useId(),
    time: useId(),
    min: useId(),
    kind: useId(),
    subj: useId(),
    weeks: useId(),
  }

  const add = () => {
    const start = new Date(`${date}T${time}:00`)
    if (Number.isNaN(start.getTime())) return
    const items = repeatWeekly(
      { start: start.toISOString(), minutes, kind, subjectId: subjectId || null, done: false },
      weeks,
      () => crypto.randomUUID(),
    )
    savePlan(items)
    setAdded(
      items.length === 1
        ? t('Sessione aggiunta.')
        : t('{length} sessioni aggiunte.', { length: items.length }),
    )
  }

  return (
    <section className="flex flex-col gap-4 border-t border-[var(--rule)] pt-6">
      <h2 className="text-lg font-medium">{t('Pianifica una sessione')}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.date} className="text-sm">
            {t('Giorno')}
          </label>
          <input
            id={ids.date}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.time} className="text-sm">
            {t('Ora')}
          </label>
          <input
            id={ids.time}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.min} className="text-sm">
            {t('Durata')}
          </label>
          <select
            id={ids.min}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={inputClass}
          >
            {[15, 25, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} {t('min')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.kind} className="text-sm">
            {t('Tipo')}
          </label>
          <select
            id={ids.kind}
            value={kind}
            onChange={(e) => setKind(e.target.value as PlanKind)}
            className={inputClass}
          >
            {(Object.keys(planKindLabel) as PlanKind[]).map((k) => (
              <option key={k} value={k}>
                {t(planKindLabel[k])}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.subj} className="text-sm">
            {t('Materia')}
          </label>
          <select
            id={ids.subj}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={inputClass}
          >
            <option value="">{t('Tutte')}</option>
            {course.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.name)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.weeks} className="text-sm">
            {t('Ripeti')}
          </label>
          <select
            id={ids.weeks}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className={inputClass}
          >
            <option value={1}>{t('Una volta')}</option>
            {[2, 4, 8, 12].map((w) => (
              <option key={w} value={w}>
                {t('Ogni settimana per')} {w} {t('settimane')}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PrimaryButton onClick={add}>{t('Aggiungi')}</PrimaryButton>
        {added && (
          <p className="text-sm text-[var(--fg-quiet)]" aria-live="polite">
            {added}
          </p>
        )}
      </div>
    </section>
  )
}
