/**
 * The weekly planner (PIANO-V3 §6). Pure and deterministic: the same input always gives the
 * same plan. It plans from `today` to Sunday; past days keep the blocks they had.
 */
import { addDays, daysBetween, localDate, mondayOf, weekday } from '../calendar/dates'
import type {
  Block,
  BlockKind,
  Chapter,
  Exercise,
  ISODate,
  Mode,
  Reason,
  Session,
  Settings,
  SimLesson,
  Window,
} from '../model/schemas'
import { dueReviews, quizReady, readingRanges, weightedPagesLeft } from './content'

export type PlannerSettings = Pick<
  Settings,
  'targetDate' | 'availability' | 'pagesPer30' | 'blockMinutes' | 'split' | 'simUnlockAfter'
>

export interface PlannerInput {
  today: ISODate
  settings: PlannerSettings
  chapters: readonly Chapter[]
  exercises: readonly Exercise[]
  simLessons: readonly SimLesson[]
  sessions: readonly Session[]
  /** Blocks already in the database (past and future). */
  blocks: readonly Block[]
  /** From the last weekly review: 0.85 heavier week, 1, or 1.1. */
  weeklyFactor: number
}

export type PlanNote =
  | { code: 'moved'; count: number }
  | { code: 'not-moved'; count: number }
  | { code: 'factor'; percent: number }
  | { code: 'finish'; date: ISODate }
  | { code: 'target-ok'; date: ISODate }
  | { code: 'target-late'; date: ISODate; finish: ISODate }
  | { code: 'all-read' }
  | { code: 'no-time' }

export interface PlanResult {
  /** New planned blocks from today to Sunday. */
  blocks: Block[]
  /** Status changes for older blocks: skipped ones, and those moved into this week. */
  updates: { id: string; status: Block['status'] }[]
  notes: PlanNote[]
  estimatedFinish: ISODate | null
}

const windowOrder: Record<Window, number> = { commute: 0, morning: 1, lunch: 2, evening: 3 }
export const shortMinutes = 15
const quickMinutes = 10
/** Skipped blocks may grow a week by at most 20% (step 9). */
const maxCarryShare = 0.2

interface Unit {
  date: ISODate
  window: Window
}

const theoryKinds: readonly BlockKind[] = ['reading', 'review', 'quiz', 'exercise']

function reason(
  code: Reason['code'],
  chapter: number | null = null,
  clarity: number | null = null,
  count: number | null = null,
): Reason {
  return { code, chapter, clarity, count }
}

function sortUnits(units: Unit[]): Unit[] {
  return units.toSorted(
    (a, b) => a.date.localeCompare(b.date) || windowOrder[a.window] - windowOrder[b.window],
  )
}

/** Slots from `from` to Sunday, one unit per block of availability. */
function unitsFrom(from: ISODate, settings: PlannerSettings): Unit[] {
  const out: Unit[] = []
  const sunday = addDays(mondayOf(from), 6)
  for (let date = from; date <= sunday; date = addDays(date, 1)) {
    for (const slot of settings.availability[weekday(date)] ?? [])
      for (let i = 0; i < slot.blocks; i++) out.push({ date, window: slot.window })
  }
  return sortUnits(out)
}

/** Scales the number of desk units by the weekly factor, removing or adding evenly. */
function scaleUnits(units: Unit[], target: number): Unit[] {
  const desk = units.filter((u) => u.window !== 'commute')
  const commute = units.filter((u) => u.window === 'commute')
  const result = [...desk]
  if (target < result.length) {
    // Drop from the busiest days first, latest slot of the day.
    while (result.length > target) {
      const counts = new Map<string, number>()
      for (const u of result) counts.set(u.date, (counts.get(u.date) ?? 0) + 1)
      const busiest = [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || b[0].localeCompare(a[0]),
      )[0]
      const index = result.findLastIndex((u) => u.date === busiest?.[0])
      result.splice(index, 1)
    }
  } else {
    // Add to the quietest days that already have a desk slot.
    let guard = 0
    while (result.length < target && desk.length > 0 && guard++ < 50) {
      const counts = new Map<string, Unit>()
      for (const u of desk) counts.set(u.date, u)
      const perDay = (d: string) => result.filter((u) => u.date === d).length
      const quietest = [...counts.values()].sort(
        (a, b) => perDay(a.date) - perDay(b.date) || a.date.localeCompare(b.date),
      )[0]
      if (!quietest) break
      result.push({ ...quietest })
    }
  }
  return sortUnits([...result, ...commute])
}

/** Week of `date` uses the review answer for the previous week; capped so it stays humane. */
export function plannedCount(deskUnits: number, factor: number): number {
  return Math.max(0, Math.round(deskUnits * factor))
}

/** True when the week's flight is unlocked: enough theory blocks done this week (step 7). */
export function simUnlocked(
  sessions: readonly Session[],
  today: ISODate,
  unlockAfter: number,
): boolean {
  return theoryDoneThisWeek(sessions, today) >= unlockAfter
}

export function theoryDoneThisWeek(sessions: readonly Session[], today: ISODate): number {
  const monday = mondayOf(today)
  return sessions.filter((s) => {
    const d = localDate(s.startedAt)
    return d >= monday && d <= today && theoryKinds.includes(s.kind)
  }).length
}

/** Projected date when the book is finished at the given reading pace. */
export function estimateFinish(
  chapters: readonly Chapter[],
  settings: PlannerSettings,
  readingBlocksPerWeek: number,
  today: ISODate,
): ISODate | null {
  const weighted = weightedPagesLeft(chapters)
  if (weighted === 0) return null
  if (readingBlocksPerWeek <= 0) return null
  const pagesPerWeek = readingBlocksPerWeek * settings.pagesPer30 * (settings.blockMinutes / 30)
  return addDays(today, Math.ceil((weighted / pagesPerWeek) * 7))
}

/** Desk blocks a typical full week offers, before the weekly factor. */
export function weeklyDeskCapacity(settings: PlannerSettings): number {
  return settings.availability
    .flat()
    .filter((s) => s.window !== 'commute')
    .reduce((n, s) => n + s.blocks, 0)
}

interface KindCounts {
  sim: number
  exercise: number
  book: number
}

function kindCounts(
  desk: number,
  input: PlannerInput,
  readingNeeded: number | null,
  simAvailable: boolean,
): KindCounts {
  const { split } = input.settings
  const sim =
    simAvailable && desk >= 3 && split.simulator > 0
      ? Math.min(2, Math.max(1, Math.round(desk * split.simulator)))
      : 0
  let exercise =
    input.exercises.length > 0 && split.exercises > 0
      ? Math.min(desk - sim, Math.max(desk >= 3 ? 1 : 0, Math.round(desk * split.exercises)))
      : 0
  let book = desk - sim - exercise
  // A target date can borrow exercise slots for reading, keeping one exercise.
  if (readingNeeded !== null && book < readingNeeded) {
    const borrow = Math.min(readingNeeded - book, Math.max(0, exercise - 1))
    exercise -= borrow
    book += borrow
  }
  return { sim, exercise, book }
}

/** Places kinds on desk units: exercises spread out, the flight after enough theory. */
function arrangeKinds(
  units: Unit[],
  counts: KindCounts,
  theoryAlready: number,
  unlockAfter: number,
): BlockKind[] {
  const n = units.length
  const kinds: BlockKind[] = Array.from({ length: n }, () => 'reading')
  for (let i = 0; i < counts.exercise; i++) {
    const at = Math.min(n - 1, Math.floor(((i + 0.5) * n) / counts.exercise))
    let j = at
    while (kinds[j] !== 'reading' && j < n - 1) j++
    kinds[j] = 'exercise'
  }
  for (let s = 0; s < counts.sim; s++) {
    const needed = Math.max(0, unlockAfter - theoryAlready)
    let at = -1
    let theory = 0
    for (let i = 0; i < n; i++) {
      const unit = units[i]
      if (unit && theory >= needed && weekday(unit.date) >= 3 && kinds[i] !== 'simulator') {
        at = i
        break
      }
      if (kinds[i] !== 'simulator') theory++
    }
    if (at === -1) {
      theory = 0
      for (let i = 0; i < n; i++) {
        if (theory >= needed && kinds[i] !== 'simulator') {
          at = i
          break
        }
        if (kinds[i] !== 'simulator') theory++
      }
    }
    if (at === -1) at = n - 1 - s
    if (at >= 0) kinds[at] = 'simulator'
  }
  return kinds
}

/** Step 6: never more than two days in a row opening with the same kind of block. */
export function spreadFirstKinds(
  units: readonly Unit[],
  kinds: readonly BlockKind[],
  before: readonly BlockKind[],
): BlockKind[] {
  const out = [...kinds]
  const days = [...new Set(units.map((u) => u.date))]
  const firstOf = (d: string) => units.findIndex((u) => u.date === d)
  const commute = (i: number) => units[i]?.window === 'commute'
  const swappable = (i: number, j: number) =>
    j !== i &&
    commute(i) === commute(j) &&
    out[i] !== 'simulator' &&
    out[j] !== 'simulator' &&
    out[j] !== out[i]
  for (let guard = 0; guard < 40; guard++) {
    const firsts = [...before, ...days.map((d) => out[firstOf(d)])]
    let violation = -1
    for (let k = before.length + 2; k < firsts.length; k++)
      if (firsts[k] === firsts[k - 1] && firsts[k] === firsts[k - 2]) {
        violation = k - before.length
        break
      }
    if (violation === -1) break
    const day = days[violation]
    const prevDay = days[violation - 1]
    if (!day) break
    const i = firstOf(day)
    // First choice: something later (same day or after) takes this day's opening slot.
    let j = units.findIndex((_, k) => k > i && swappable(i, k))
    let target = i
    if (j === -1 && prevDay) {
      // Otherwise reshuffle the previous day's own blocks.
      target = firstOf(prevDay)
      j = units.findIndex((u, k) => k > target && u.date === prevDay && swappable(target, k))
    }
    if (j === -1) break
    const a = out[target]
    const b = out[j]
    if (a === undefined || b === undefined) break
    out[target] = b
    out[j] = a
  }
  return out
}

function pickExercise(
  exercises: readonly Exercise[],
  used: Map<string, number>,
  avoidSubject: string | null,
): Exercise | null {
  const ranked = exercises
    .filter((e) => e.perWeek > 0)
    .toSorted((a, b) => {
      const da = (used.get(a.id) ?? 0) / a.perWeek
      const db = (used.get(b.id) ?? 0) / b.perWeek
      const sa = a.subject === avoidSubject ? 1 : 0
      const sb = b.subject === avoidSubject ? 1 : 0
      return da - db || sa - sb || a.id.localeCompare(b.id)
    })
  const pick = ranked[0] ?? exercises[0] ?? null
  if (pick) used.set(pick.id, (used.get(pick.id) ?? 0) + 1)
  return pick
}

function nextSimLesson(lessons: readonly SimLesson[]): SimLesson | null {
  return (
    lessons.filter((l) => l.status !== 'passed').toSorted((a, b) => a.order - b.order)[0] ?? null
  )
}

export function planWeek(input: PlannerInput): PlanResult {
  const { today, settings } = input
  const notes: PlanNote[] = []
  const updates: PlanResult['updates'] = []
  const monday = mondayOf(today)

  // Step 9: skipped blocks of this and last week don't pile up as a backlog.
  const doneBlockIds = new Set(input.sessions.map((s) => s.blockId))
  const stale = input.blocks.filter(
    (b) => b.status === 'planned' && b.date < today && !b.extra && !doneBlockIds.has(b.id),
  )
  for (const b of stale) updates.push({ id: b.id, status: 'skipped' })
  const skipped = [
    ...input.blocks.filter((b) => b.status === 'skipped' && b.date >= addDays(monday, -7)),
    ...stale,
  ].filter((b) => b.kind !== 'simulator')

  const allUnits = unitsFrom(today, settings)
  const deskUnits = allUnits.filter((u) => u.window !== 'commute')
  let target = plannedCount(deskUnits.length, input.weeklyFactor)
  if (input.weeklyFactor !== 1)
    notes.push({ code: 'factor', percent: Math.round((input.weeklyFactor - 1) * 100) })

  const carryRoom = Math.ceil(target * maxCarryShare)
  const carry = Math.min(skipped.length, carryRoom)
  if (carry > 0) {
    target += carry
    notes.push({ code: 'moved', count: carry })
    for (const b of skipped.slice(0, carry))
      if (b.status === 'skipped') updates.push({ id: b.id, status: 'moved' })
      else {
        const u = updates.find((x) => x.id === b.id)
        if (u) u.status = 'moved'
      }
  }
  if (skipped.length > carry) notes.push({ code: 'not-moved', count: skipped.length - carry })

  const units = scaleUnits(allUnits, target)
  const desk = units.filter((u) => u.window !== 'commute')
  if (units.length === 0) notes.push({ code: 'no-time' })

  // Step 1: with a target date, how many reading blocks a week the book needs.
  const weighted = weightedPagesLeft(input.chapters)
  const pagesPerBlock = settings.pagesPer30 * (settings.blockMinutes / 30)
  let readingNeeded: number | null = null
  if (settings.targetDate && weighted > 0) {
    const weeksLeft = Math.max(1, daysBetween(today, settings.targetDate) / 7)
    readingNeeded = Math.ceil(weighted / weeksLeft / pagesPerBlock)
  }

  const theoryAlready = theoryDoneThisWeek(input.sessions, today)
  const lesson = nextSimLesson(input.simLessons)
  const counts = kindCounts(desk.length, input, readingNeeded, lesson !== null)
  const firstsBefore = input.blocks
    .filter((b) => b.date >= monday && b.date < today && b.order === 0)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .map((b) => b.kind)

  // Book share: due reviews and ready quizzes take reading slots; commute slots get only
  // phone-sized reviews and quizzes (steps 4, 5 and 8).
  const reviewQueue = dueReviews(input.chapters, input.sessions).filter(
    (r) => r.due <= addDays(monday, 6),
  )
  const quizQueue = quizReady(input.chapters, input.sessions)
  const deskKinds = arrangeKinds(desk, counts, theoryAlready, settings.simUnlockAfter)
  const anythingRead = input.chapters.some((c) => c.pageReached !== null)

  const merged = units.map((unit) => ({
    unit,
    kind: (unit.window === 'commute' ? 'commute' : (deskKinds[desk.indexOf(unit)] ?? 'reading')) as
      | BlockKind
      | 'commute',
  }))

  const reviewsLeft = [...reviewQueue]
  for (const r of reviewQueue) {
    const from = [r.due, today].toSorted().at(-1) ?? today
    const slot =
      merged.find((m) => m.kind === 'commute' && m.unit.date >= from) ??
      merged.find((m) => m.kind === 'reading' && m.unit.date >= from)
    if (slot) {
      slot.kind = 'review'
      reviewsLeft.splice(reviewsLeft.indexOf(r), 1)
    }
  }
  let quizzesToPlace = quizQueue.length
  for (const m of merged) {
    if (m.kind !== 'commute' || quizzesToPlace === 0) continue
    m.kind = 'quiz'
    quizzesToPlace--
  }
  const readingSlots = merged.filter((m) => m.kind === 'reading')
  const quizCap = Math.max(1, Math.floor(readingSlots.length / 4))
  let deskQuizzes = 0
  for (const m of readingSlots.slice(1)) {
    if (quizzesToPlace === 0 || deskQuizzes >= quizCap) break
    m.kind = 'quiz'
    quizzesToPlace--
    deskQuizzes++
  }
  let alternate = 0
  for (const m of merged) {
    if (m.kind !== 'commute') continue
    // Nothing due: a quick look back at the latest chapter, or practice before any reading.
    m.kind = anythingRead
      ? alternate++ % 2 === 0 || quizQueue.length === 0
        ? 'review'
        : 'quiz'
      : 'exercise'
  }

  const spread = spreadFirstKinds(
    merged.map((m) => m.unit),
    merged.map((m) => (m.kind === 'commute' ? 'review' : m.kind)),
    firstsBefore,
  )
  type Planned = { unit: Unit; kind: BlockKind; minutes: number; mode: Mode }
  const planned: Planned[] = merged.map((m, i) => {
    const isCommute = m.unit.window === 'commute'
    const kind = spread[i] ?? 'reading'
    return {
      unit: m.unit,
      kind,
      minutes: isCommute ? shortMinutes : kind === 'simulator' ? 45 : settings.blockMinutes,
      mode: isCommute ? 'on-the-go' : kind === 'simulator' ? 'simulator' : 'desk',
    }
  })

  // Fill content in date order so reading ranges stay consecutive.
  const readingCount = planned.filter((p) => p.kind === 'reading').length
  const ranges = readingRanges(
    input.chapters,
    settings.pagesPer30,
    settings.blockMinutes,
    readingCount,
  )
  let rangeIndex = 0
  const exerciseUse = new Map<string, number>()
  const blocks: Block[] = []
  const perDay = new Map<string, number>()
  let lastSubject: string | null = null
  const recent = input.chapters
    .filter((c) => c.pageReached !== null)
    .toSorted((a, b) => b.order - a.order)[0]

  for (const p of planned) {
    const order = perDay.get(p.unit.date) ?? 0
    perDay.set(p.unit.date, order + 1)
    const base = {
      id: `b-${p.unit.date}-${order}`,
      date: p.unit.date,
      order,
      window: p.unit.window,
      minutes: p.minutes,
      mode: p.mode,
      status: 'planned' as const,
      extra: false,
    }
    if (p.kind === 'reading') {
      const range = ranges[rangeIndex++]
      if (range) {
        lastSubject = range.chapter.subject
        blocks.push({
          ...base,
          kind: 'reading',
          ref: { type: 'chapter', id: range.chapter.id },
          pageFrom: range.from,
          pageTo: range.to,
          content: `p. ${range.from}–${range.to}`,
          why: reason(
            range.finishesChapter ? 'reading-finish' : 'reading-next',
            range.chapter.order,
          ),
        })
        continue
      }
      // Nothing left to read: practise instead.
      p.kind = quizQueue.length > 0 ? 'quiz' : reviewQueue.length > 0 ? 'review' : 'exercise'
    }
    if (p.kind === 'review') {
      const index = reviewQueue.findIndex((r) => r.due <= p.unit.date)
      const due = index === -1 ? undefined : reviewQueue.splice(index, 1)[0]
      const chapter = due?.chapter ?? recent
      if (chapter) {
        lastSubject = chapter.subject
        blocks.push({
          ...base,
          kind: 'review',
          ref: { type: 'chapter', id: chapter.id },
          pageFrom: chapter.pageStart,
          pageTo: chapter.pageReached ?? chapter.pageEnd,
          content: `Review p. ${chapter.pageStart}–${chapter.pageReached ?? chapter.pageEnd}`,
          why: due
            ? reason('review', chapter.order, chapter.lastClarity, due.nth)
            : reason('commute', chapter.order),
        })
        continue
      }
      p.kind = 'exercise'
    }
    if (p.kind === 'quiz') {
      const chapter = quizQueue.shift()
      if (chapter) {
        lastSubject = chapter.subject
        blocks.push({
          ...base,
          kind: 'quiz',
          ref: { type: 'chapter', id: chapter.id },
          pageFrom: null,
          pageTo: null,
          content: 'quizppl.it',
          why: reason('quiz', chapter.order, chapter.lastClarity),
        })
        continue
      }
      p.kind = 'exercise'
    }
    if (p.kind === 'simulator' && lesson) {
      blocks.push({
        ...base,
        kind: 'simulator',
        ref: { type: 'sim', id: lesson.id },
        pageFrom: null,
        pageTo: null,
        content: lesson.title,
        why: reason('simulator', null, null, settings.simUnlockAfter),
      })
      continue
    }
    const exercise = pickExercise(input.exercises, exerciseUse, lastSubject)
    if (exercise) {
      lastSubject = exercise.subject
      blocks.push({
        ...base,
        kind: 'exercise',
        ref: { type: 'exercise', id: exercise.id },
        pageFrom: null,
        pageTo: null,
        content: exercise.title,
        why: reason(p.unit.window === 'commute' ? 'commute' : 'exercise'),
      })
    }
  }

  // Step 1 and 9: say when the book will be done at this pace.
  const readingPerWeek = Math.max(
    1,
    Math.round(
      plannedCount(weeklyDeskCapacity(settings), input.weeklyFactor) * settings.split.book,
    ),
  )
  const estimatedFinish = estimateFinish(
    input.chapters,
    settings,
    Math.max(readingPerWeek, readingNeeded ?? 0) > readingPerWeek && settings.targetDate
      ? Math.min(readingNeeded ?? readingPerWeek, counts.book)
      : readingPerWeek,
    today,
  )
  if (weighted === 0) notes.push({ code: 'all-read' })
  else if (settings.targetDate && estimatedFinish) {
    if (estimatedFinish <= settings.targetDate)
      notes.push({ code: 'target-ok', date: settings.targetDate })
    else notes.push({ code: 'target-late', date: settings.targetDate, finish: estimatedFinish })
  } else if (estimatedFinish) notes.push({ code: 'finish', date: estimatedFinish })

  return { blocks, updates, notes, estimatedFinish }
}

/** "I only have 10 minutes": a short review, quiz or exercise that fits (PIANO-V3 §5.2). */
export function quickBlock(input: PlannerInput): Block | null {
  const base = {
    id: `q-${input.today}-${input.blocks.length}`,
    date: input.today,
    order: 99,
    window: 'evening' as const,
    minutes: quickMinutes,
    mode: 'desk' as const,
    status: 'planned' as const,
    extra: true,
    pageFrom: null,
    pageTo: null,
  }
  const review = dueReviews(input.chapters, input.sessions).find((r) => r.due <= input.today)
  const chapter =
    review?.chapter ??
    input.chapters.filter((c) => c.pageReached !== null).toSorted((a, b) => b.order - a.order)[0]
  if (chapter)
    return {
      ...base,
      kind: 'review',
      ref: { type: 'chapter', id: chapter.id },
      pageFrom: chapter.pageStart,
      pageTo: chapter.pageReached ?? chapter.pageEnd,
      content: `Quick review p. ${chapter.pageStart}–${chapter.pageReached ?? chapter.pageEnd}`,
      why: reason('quick', chapter.order),
    }
  const exercise = input.exercises.find((e) => e.kind === 'flight-computer') ?? input.exercises[0]
  if (exercise)
    return {
      ...base,
      kind: 'exercise',
      ref: { type: 'exercise', id: exercise.id },
      content: exercise.title,
      why: reason('quick'),
    }
  return null
}

/** A free day's extra block: the next pages, or practice once the book is read. */
export function extraBlock(input: PlannerInput): Block | null {
  const { settings } = input
  const base = {
    id: `x-${input.today}-${input.blocks.length}`,
    date: input.today,
    order: 50,
    window: 'evening' as const,
    minutes: settings.blockMinutes,
    mode: 'desk' as const,
    status: 'planned' as const,
    extra: true,
  }
  const range = readingRanges(input.chapters, settings.pagesPer30, settings.blockMinutes, 1)[0]
  if (range)
    return {
      ...base,
      kind: 'reading',
      ref: { type: 'chapter', id: range.chapter.id },
      pageFrom: range.from,
      pageTo: range.to,
      content: `p. ${range.from}–${range.to}`,
      why: reason('extra', range.chapter.order),
    }
  const exercise = input.exercises[0]
  if (!exercise) return null
  return {
    ...base,
    kind: 'exercise',
    ref: { type: 'exercise', id: exercise.id },
    pageFrom: null,
    pageTo: null,
    content: exercise.title,
    why: reason('extra'),
  }
}

export interface WeekProjection {
  monday: ISODate
  blocks: number
  chapters: string[]
}

/** Month view: blocks per week and the chapters expected in each (PIANO-V3 §5.5). */
export function projectWeeks(input: PlannerInput, weeks: number): WeekProjection[] {
  const { settings } = input
  const perWeek = plannedCount(weeklyDeskCapacity(settings), input.weeklyFactor)
  const reading = Math.max(1, Math.round(perWeek * settings.split.book))
  const ranges = readingRanges(
    input.chapters,
    settings.pagesPer30,
    settings.blockMinutes,
    reading * weeks,
  )
  const out: WeekProjection[] = []
  const start = mondayOf(input.today)
  for (let w = 0; w < weeks; w++) {
    const slice = ranges.slice(w * reading, (w + 1) * reading)
    out.push({
      monday: addDays(start, w * 7),
      blocks: perWeek,
      chapters: [...new Set(slice.map((r) => r.chapter.id))],
    })
  }
  return out
}
