<script lang="ts">
  import Button from '../../components/Button.svelte'
  import Card from '../../components/Card.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import MilestoneCard from '../../components/MilestoneCard.svelte'
  import ProgressBar from '../../components/ProgressBar.svelte'
  import { daysBetween, localDate, mondayOf, weekday } from '../../core/calendar/dates'
  import { defaultSettings } from '../../core/model/defaults'
  import type { Block } from '../../core/model/schemas'
  import type { PlanNote } from '../../core/planner/week'
  import { copy, formatDay, greeting } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { describeBlock } from '../../lib/describe'
  import { live } from '../../lib/live.svelte'
  import { go, href } from '../../lib/nav'

  type Ops = typeof import('./today-ops')

  const day = localDate(Date.now())
  const monday = mondayOf(day)

  let ops = $state.raw<Ops | null>(null)
  let notes = $state<PlanNote[]>([])
  let ready = $state(false)
  let goal = $state(0)
  let openWhy = $state<string | null>(null)
  let busy = $state(false)

  $effect(() => {
    void (async () => {
      const [settings, loaded] = await Promise.all([
        db.settings.get('settings'),
        import('./today-ops'),
      ])
      if (!settings?.onboarded) {
        go('welcome')
        return
      }
      ops = loaded
      const plan = await loaded.ensurePlan(day)
      notes = (plan?.notes ?? []).filter(
        (n) => n.code === 'moved' || n.code === 'not-moved' || n.code === 'factor',
      )
      goal = await loaded.weeklyGoal()
      ready = true
    })()
  })

  const data = live(async () => {
    const [
      blocks,
      active,
      sessions,
      chapters,
      exercises,
      simLessons,
      milestones,
      settings,
      reviews,
    ] = await Promise.all([
      db.blocks.where('date').equals(day).toArray(),
      db.active.get('active'),
      db.sessions
        .where('startedAt')
        .aboveOrEqual(new Date(`${monday}T00:00:00`).getTime())
        .toArray(),
      db.chapters.orderBy('order').toArray(),
      db.exercises.toArray(),
      db.simLessons.orderBy('order').toArray(),
      db.milestones.toArray(),
      db.settings.get('settings'),
      db.weeklyReviews.toArray(),
    ])
    return {
      blocks,
      active,
      sessions,
      chapters,
      exercises,
      simLessons,
      milestones,
      settings: settings ?? defaultSettings(),
      reviews,
    }
  }, null)

  const today = $derived(
    (data.value?.blocks ?? []).toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  )
  const theoryDone = $derived(ops ? ops.theoryDoneThisWeek(data.value?.sessions ?? [], day) : 0)
  const unlockAfter = $derived(data.value?.settings.simUnlockAfter ?? 3)
  const locked = (b: Block) => b.kind === 'simulator' && theoryDone < unlockAfter
  const planned = $derived(today.filter((b) => b.status === 'planned'))
  const next = $derived(planned.find((b) => !locked(b)) ?? planned[0] ?? null)
  const rest = $derived(planned.filter((b) => b !== next))
  const doneThisWeek = $derived(data.value?.sessions.length ?? 0)
  const weekHasSim = $derived(planned.some((b) => b.kind === 'simulator'))

  const freshMilestones = $derived.by(() => {
    const v = data.value
    if (!v || !ops) return []
    const shown = v.milestones.filter((m) => !m.seen || m.reachedOn === day)
    if (shown.length === 0) return []
    const all = ops.evaluateMilestones({
      sessions: v.sessions,
      chapters: v.chapters,
      simLessons: v.simLessons,
      exercises: v.exercises,
      weeklyGoal: goal,
    })
    return shown.flatMap((m) => {
      const def = all.find((x) => x.id === m.id)
      return def ? [{ ...def, reachedOn: m.reachedOn }] : []
    })
  })

  $effect(() => {
    const unseen = (data.value?.milestones ?? []).filter((m) => !m.seen).map((m) => m.id)
    if (unseen.length > 0 && ops) void ops.markMilestonesSeen(unseen)
  })

  const backupDue = $derived.by(() => {
    const s = data.value?.settings
    if (!s || weekday(day) !== 0) return false
    if (s.lastBackupAt === null) return (data.value?.sessions.length ?? 0) > 0
    return daysBetween(localDate(s.lastBackupAt), day) > 14
  })

  const reviewWeek = $derived(
    ops
      ? ops.reviewDue(
          day,
          (data.value?.reviews ?? []).map((r) => r.week),
        )
      : null,
  )

  const catalogue = $derived({
    chapters: data.value?.chapters ?? [],
    exercises: data.value?.exercises ?? [],
    simLessons: data.value?.simLessons ?? [],
  })

  async function start(block: Block) {
    if (busy || !ops) return
    busy = true
    try {
      await ops.startBlock(block)
      go('session')
    } finally {
      busy = false
    }
  }

  async function quick() {
    if (busy || !ops) return
    const block = ops.quickBlock(await ops.plannerInput(day))
    if (!block) return
    busy = true
    try {
      await ops.addBlock(block)
      await ops.startBlock(block)
      go('session')
    } finally {
      busy = false
    }
  }

  async function extra() {
    if (!ops) return
    const block = ops.extraBlock(await ops.plannerInput(day))
    if (block) await ops.addBlock(block)
  }
</script>

{#if !ready || !data.ready}
  <p class="loading" role="status">{copy.app.loading}</p>
{:else if data.value}
  <header class="head">
    <h1>{greeting(new Date(), day)}</h1>
    <p class="date">{formatDay(day)}</p>
  </header>

  {#if goal > 0}
    <ProgressBar
      value={doneThisWeek}
      max={goal}
      label={copy.today.weekGoal}
      valueText={copy.today.weekGoalValue(doneThisWeek, goal)}
      segmented={goal <= 14}
    />
  {/if}

  {#each notes as note}
    <InlineNotice title={copy.today.planUpdated}>{copy.note(note)}</InlineNotice>
  {/each}

  {#if data.value.active}
    {@const d = describeBlock(data.value.active.block, catalogue)}
    <Card as="section" elevation="raised" labelledby="resume-title">
      <p class="meta">{copy.today.resumeHint}</p>
      <h2 id="resume-title" class="block-title">{d.title}</h2>
      <p class="detail">{d.detail}</p>
      <Button variant="primary" size="lg" full href={href('session')}>{copy.today.resume}</Button>
    </Card>
  {:else if next}
    {@const d = describeBlock(next, catalogue)}
    <Card as="section" elevation="raised" labelledby="next-title">
      <p class="meta">
        {copy.kind[next.kind]} · {copy.block.minutes(next.minutes)} · {copy.mode[next.mode]}
      </p>
      <div class="title-row">
        <h2 id="next-title" class="block-title">{d.title}</h2>
        <Button variant="quiet" onclick={() => (openWhy = openWhy === next.id ? null : next.id)}>
          {copy.today.why}
        </Button>
      </div>
      {#if d.detail}<p class="detail">{d.detail}</p>{/if}
      {#if openWhy === next.id}<p class="why">{copy.why(next.why)}</p>{/if}
      {#if next.kind === 'simulator'}
        {#if locked(next)}
          <p class="note">{copy.today.simLocked(unlockAfter - theoryDone)}</p>
        {:else}
          <InlineNotice tone="success">{copy.today.simUnlocked}</InlineNotice>
        {/if}
      {/if}
      <Button variant="primary" size="lg" full disabled={busy || locked(next)} onclick={() => start(next)}>
        {copy.today.start}
      </Button>
    </Card>
  {:else if today.length === 0}
    <Card as="section">
      <p>{copy.today.freeDay}</p>
      <div><Button onclick={extra}>{copy.today.addExtra}</Button></div>
    </Card>
  {:else}
    <Card as="section">
      <p>{copy.today.allDone}</p>
    </Card>
  {/if}

  {#if !data.value.active && weekHasSim && next?.kind !== 'simulator' && theoryDone >= unlockAfter}
    <InlineNotice tone="success">{copy.today.simUnlocked}</InlineNotice>
  {/if}

  {#if rest.length > 0}
    <details class="more">
      <summary>{copy.today.more} ({rest.length})</summary>
      <ul>
        {#each rest as block (block.id)}
          {@const d = describeBlock(block, catalogue)}
          <li>
            <div>
              <p class="meta">{copy.kind[block.kind]} · {copy.block.minutes(block.minutes)} · {copy.window[block.window]}</p>
              <p>{d.title}</p>
              {#if d.detail}<p class="detail">{d.detail}</p>{/if}
            </div>
            <Button disabled={busy || locked(block)} onclick={() => start(block)}>{copy.today.start}</Button>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  {#if !data.value.active}
    <div><Button variant="secondary" disabled={busy} onclick={quick}>{copy.today.tenMinutes}</Button></div>
  {/if}

  {#each freshMilestones as m (m.id)}
    <section aria-label={copy.today.milestoneReached}>
      <MilestoneCard title={m.title} sentence={m.sentence} reachedOn={m.reachedOn} />
    </section>
  {/each}

  {#if reviewWeek && (data.value.sessions.length > 0 || weekday(day) === 0)}
    <InlineNotice>
      {copy.today.weeklyReview}
      {#snippet action()}<Button href={href('week')}>{copy.today.weeklyReviewAction}</Button>{/snippet}
    </InlineNotice>
  {/if}

  {#if backupDue}
    <InlineNotice tone="attention">
      {data.value.settings.lastBackupAt === null ? copy.today.backupNever : copy.today.backupReminder}
      {#snippet action()}<Button href={href('settings')}>{copy.today.backupAction}</Button>{/snippet}
    </InlineNotice>
  {/if}
{/if}

<style>
  .loading {
    color: var(--color-text-secondary);
  }

  .head {
    display: grid;
    gap: var(--space-1);
  }

  .date,
  .meta,
  .detail,
  .note {
    color: var(--color-text-secondary);
  }

  .meta {
    font-size: var(--text-sm);
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .block-title {
    font-size: var(--text-lg);
  }

  .why {
    padding: var(--space-3);
    border-left: var(--border-thick) solid var(--color-rule);
    font-size: var(--text-sm);
  }

  .more summary {
    min-height: var(--target-min);
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: var(--font-weight-medium);
  }

  .more ul {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .more li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: var(--border-thin) solid var(--color-rule);
  }
</style>
