/**
 * The app's operations on the database: thin glue between src/core (pure logic) and Dexie.
 * Every change fires `vector:changed`, which the sync runner listens to.
 */
import { type MergeSummary, mergeSnapshots } from '../core/backup/merge'
import { addDays, localDate, mondayOf } from '../core/calendar/dates'
import { evaluateMilestones } from '../core/milestones/milestones'
import type { StartingContent } from '../core/model/content'
import { defaultSettings } from '../core/model/defaults'
import type {
  ActiveSession,
  Block,
  FocusAggregate,
  ISODate,
  Milestone,
  Settings,
  Snapshot,
} from '../core/model/schemas'
import {
  type PlannerInput,
  type PlanResult,
  plannedCount,
  planWeek,
  weeklyDeskCapacity,
} from '../core/planner/week'
import { startTimer } from '../core/session/timer'
import { type WrapUp, type WrapUpResult, wrapUpSession } from '../core/session/wrapup'
import { feelingFactor } from '../core/stats/stats'
import { db } from './db'
import { notifyChange } from './events'

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function today(): ISODate {
  return localDate(Date.now())
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? defaultSettings()
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, updatedAt: Date.now() }
  await db.settings.put(next)
  notifyChange()
  return next
}

/** First run: starting content in, settings saved, storage made persistent (§8). */
export async function completeOnboarding(
  content: StartingContent,
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  await db.transaction('rw', [db.settings, db.chapters, db.exercises, db.simLessons], async () => {
    if ((await db.chapters.count()) === 0) await db.chapters.bulkPut(content.chapters)
    if ((await db.exercises.count()) === 0) await db.exercises.bulkPut(content.exercises)
    if ((await db.simLessons.count()) === 0) await db.simLessons.bulkPut(content.simLessons)
    await db.settings.put({
      ...(await getSettings()),
      bookEdition: content.edition,
      ...patch,
      onboarded: true,
      updatedAt: Date.now(),
    })
  })
  await requestPersistence()
  notifyChange()
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

export async function exportSnapshot(): Promise<Snapshot> {
  const [
    settings,
    chapters,
    exercises,
    simLessons,
    blocks,
    sessions,
    calibrations,
    milestones,
    weeklyReviews,
    active,
  ] = await Promise.all([
    db.settings.toArray(),
    db.chapters.toArray(),
    db.exercises.toArray(),
    db.simLessons.toArray(),
    db.blocks.toArray(),
    db.sessions.toArray(),
    db.calibrations.toArray(),
    db.milestones.toArray(),
    db.weeklyReviews.toArray(),
    db.active.toArray(),
  ])
  return {
    app: 'vector',
    version: 1,
    exportedAt: Date.now(),
    data: {
      settings,
      chapters,
      exercises,
      simLessons,
      blocks,
      sessions,
      calibrations,
      milestones,
      weeklyReviews,
      active,
    },
  }
}

async function writeSnapshot(s: Snapshot) {
  await Promise.all(db.dataTables.map((t) => t.clear()))
  const d = s.data
  await db.settings.bulkPut(d.settings)
  await db.chapters.bulkPut(d.chapters)
  await db.exercises.bulkPut(d.exercises)
  await db.simLessons.bulkPut(d.simLessons)
  await db.blocks.bulkPut(d.blocks)
  await db.sessions.bulkPut(d.sessions)
  await db.calibrations.bulkPut(d.calibrations)
  await db.milestones.bulkPut(d.milestones)
  await db.weeklyReviews.bulkPut(d.weeklyReviews)
  await db.active.bulkPut(d.active)
}

/** Merges another device's data in, inside one transaction (ADR 0004). */
export async function mergeIn(
  incoming: Snapshot,
  options: { silent?: boolean } = {},
): Promise<{ summary: MergeSummary; merged: Snapshot }> {
  let result: { summary: MergeSummary; merged: Snapshot } | null = null
  await db.transaction('rw', db.dataTables, async () => {
    const local = await exportSnapshot()
    result = mergeSnapshots(local, incoming)
    await writeSnapshot(result.merged)
  })
  if (!result) throw new Error('Merge failed')
  if (!options.silent) notifyChange()
  return result
}

/** Preview of an import, without writing anything. */
export async function previewMerge(incoming: Snapshot): Promise<MergeSummary> {
  return mergeSnapshots(await exportSnapshot(), incoming).summary
}

export async function deleteEverything(): Promise<void> {
  await db.transaction('rw', [...db.dataTables, db.sync], async () => {
    await Promise.all([...db.dataTables, db.sync].map((t) => t.clear()))
  })
}

async function weeklyFactor(day: ISODate): Promise<number> {
  const review = await db.weeklyReviews.get(addDays(mondayOf(day), -7))
  return review?.factor ?? 1
}

export async function plannerInput(day: ISODate): Promise<PlannerInput> {
  const [settings, chapters, exercises, simLessons, sessions, blocks, factor] = await Promise.all([
    getSettings(),
    db.chapters.orderBy('order').toArray(),
    db.exercises.toArray(),
    db.simLessons.orderBy('order').toArray(),
    db.sessions.toArray(),
    db.blocks
      .where('date')
      .aboveOrEqual(addDays(mondayOf(day), -7))
      .toArray(),
    weeklyFactor(day),
  ])
  return {
    today: day,
    settings,
    chapters,
    exercises,
    simLessons,
    sessions,
    blocks,
    weeklyFactor: factor,
  }
}

/** The weekly goal: blocks planned for a full week. */
export async function weeklyGoal(): Promise<number> {
  const s = await getSettings()
  const commute = s.availability
    .flat()
    .filter((x) => x.window === 'commute')
    .reduce((n, x) => n + x.blocks, 0)
  return plannedCount(weeklyDeskCapacity(s), await weeklyFactor(today())) + commute
}

export async function previewPlan(day: ISODate): Promise<PlanResult> {
  return planWeek(await plannerInput(day))
}

/** Replaces planned (not done) blocks from `day` on with a new plan. */
export async function applyPlan(day: ISODate, plan: PlanResult): Promise<void> {
  await db.transaction('rw', db.blocks, async () => {
    const sunday = addDays(mondayOf(day), 6)
    const old = await db.blocks
      .where('date')
      .between(day, sunday, true, true)
      .filter((b) => b.status === 'planned' && !b.extra)
      .primaryKeys()
    await db.blocks.bulkDelete(old)
    for (const u of plan.updates) await db.blocks.update(u.id, { status: u.status })
    await db.blocks.bulkPut(plan.blocks)
  })
  notifyChange()
}

/** Plans the current week the first time it is opened. */
export async function ensurePlan(day: ISODate): Promise<PlanResult | null> {
  const monday = mondayOf(day)
  const planned = await db.blocks
    .where('date')
    .between(monday, addDays(monday, 6), true, true)
    .filter((b) => !b.extra)
    .count()
  if (planned > 0) return null
  const plan = await previewPlan(day)
  await applyPlan(day, plan)
  return plan
}

export async function addBlock(block: Block): Promise<void> {
  await db.blocks.put(block)
  notifyChange()
}

export async function startBlock(block: Block, now = Date.now()): Promise<ActiveSession> {
  const active: ActiveSession = {
    id: 'active',
    block,
    timer: startTimer(now, block.minutes * 60_000),
    leftApp: 0,
    hiddenAt: null,
    focus: null,
    pageReached: null,
  }
  await db.active.put(active)
  notifyChange()
  return active
}

export async function getActive(): Promise<ActiveSession | undefined> {
  return db.active.get('active')
}

export async function saveActive(active: ActiveSession, quiet = true): Promise<void> {
  await db.active.put(active)
  if (!quiet) notifyChange()
}

export async function discardActive(): Promise<void> {
  await db.active.delete('active')
  notifyChange()
}

export interface FinishResult {
  feedback: WrapUpResult['feedback']
  newMilestones: Milestone[]
}

export async function finishSession(
  active: ActiveSession,
  input: WrapUp,
  focus: FocusAggregate | null,
  now = Date.now(),
): Promise<FinishResult> {
  const settings = await getSettings()
  const ref = active.block.ref
  const chapter = ref?.type === 'chapter' ? ((await db.chapters.get(ref.id)) ?? null) : null
  const simLesson = ref?.type === 'sim' ? ((await db.simLessons.get(ref.id)) ?? null) : null
  const result = wrapUpSession({
    id: newId('s'),
    active,
    now,
    input,
    chapter,
    simLesson,
    pagesPer30: settings.pagesPer30,
    focus,
  })
  await db.transaction(
    'rw',
    [db.sessions, db.chapters, db.simLessons, db.blocks, db.active, db.settings],
    async () => {
      await db.sessions.put(result.session)
      if (result.chapter) await db.chapters.put(result.chapter)
      if (result.simLesson) await db.simLessons.put(result.simLesson)
      if (await db.blocks.get(active.block.id))
        await db.blocks.update(active.block.id, { status: 'done' })
      else await db.blocks.put({ ...active.block, status: 'done' })
      if (result.pagesPer30 !== null)
        await db.settings.put({ ...settings, pagesPer30: result.pagesPer30, updatedAt: Date.now() })
      await db.active.delete('active')
    },
  )
  const newMilestones = await recordMilestones(now)
  notifyChange()
  return { feedback: result.feedback, newMilestones }
}

/** Stores milestones reached for the first time, unseen until shown on Today. */
export async function recordMilestones(now = Date.now()): Promise<Milestone[]> {
  const [sessions, chapters, simLessons, exercises, stored, goal] = await Promise.all([
    db.sessions.toArray(),
    db.chapters.toArray(),
    db.simLessons.toArray(),
    db.exercises.toArray(),
    db.milestones.toArray(),
    weeklyGoal(),
  ])
  const known = new Set(stored.map((m) => m.id))
  const fresh = evaluateMilestones({ sessions, chapters, simLessons, exercises, weeklyGoal: goal })
    .filter((m) => m.reachedOn !== null && !known.has(m.id))
    .map((m) => ({ id: m.id, reachedOn: m.reachedOn ?? localDate(now), seen: false }))
  if (fresh.length > 0) await db.milestones.bulkPut(fresh)
  return fresh
}

export async function markMilestonesSeen(ids: readonly string[]): Promise<void> {
  await db.milestones
    .where('id')
    .anyOf([...ids])
    .modify({ seen: true })
  notifyChange()
}

export async function saveWeeklyReview(
  week: ISODate,
  feeling: keyof typeof feelingFactor,
): Promise<void> {
  await db.weeklyReviews.put({ week, feeling, factor: feelingFactor[feeling], doneAt: Date.now() })
  notifyChange()
}
