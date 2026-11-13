<script lang="ts">
  import EmptyState from '../../components/EmptyState.svelte'
  import MilestoneCard from '../../components/MilestoneCard.svelte'
  import { evaluateMilestones, type MilestoneState } from '../../core/milestones/milestones'
  import { copy } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { live } from '../../lib/live.svelte'
  import { weeklyGoal } from '../../lib/repo'

  const data = live(async () => {
    const [sessions, chapters, simLessons, exercises, stored, goal] = await Promise.all([
      db.sessions.toArray(),
      db.chapters.toArray(),
      db.simLessons.toArray(),
      db.exercises.toArray(),
      db.milestones.toArray(),
      weeklyGoal(),
    ])
    const all = evaluateMilestones({ sessions, chapters, simLessons, exercises, weeklyGoal: goal })
    // The first date stored on this device wins (it may come from another device too).
    return all.map((m) => ({
      ...m,
      reachedOn: stored.find((s) => s.id === m.id)?.reachedOn ?? m.reachedOn,
    }))
  }, [] as MilestoneState[])

  const reached = $derived(
    data.value
      .filter((m) => m.reachedOn !== null)
      .toSorted((a, b) => (b.reachedOn ?? '').localeCompare(a.reachedOn ?? '')),
  )
  /** The next stops: closest first, a handful only, to give direction (§9). */
  const next = $derived(
    data.value
      .filter((m) => m.reachedOn === null && m.progress !== null && m.progress.unit !== 'none')
      .toSorted((a, b) => ratio(b) - ratio(a))
      .slice(0, 5),
  )
  const ratio = (m: MilestoneState) =>
    m.progress ? m.progress.value / Math.max(1, m.progress.max) : 0

  function progressText(m: MilestoneState) {
    const p = m.progress
    if (!p || p.unit === 'none') return ''
    return copy.milestone.progress[p.unit](p.value, p.max)
  }
</script>

<h1>{copy.milestone.title}</h1>

{#if data.ready}
  <section class="group" aria-labelledby="next-title">
    <h2 id="next-title">{copy.milestone.next}</h2>
    {#each next as m (m.id)}
      <MilestoneCard
        title={m.title}
        sentence={m.sentence}
        reachedOn={null}
        progress={{ value: m.progress?.value ?? 0, max: m.progress?.max ?? 1, text: progressText(m) }}
      />
    {/each}
  </section>

  <section class="group" aria-labelledby="reached-title">
    <h2 id="reached-title">{copy.milestone.reached}</h2>
    {#if reached.length === 0}
      <EmptyState level={3} title={copy.milestone.reached} body={copy.milestone.emptyReached} />
    {:else}
      {#each reached as m (m.id)}
        <MilestoneCard title={m.title} sentence={m.sentence} reachedOn={m.reachedOn} />
      {/each}
    {/if}
  </section>
{:else}
  <p role="status">{copy.app.loading}</p>
{/if}

<style>
  .group {
    display: grid;
    gap: var(--space-4);
  }
</style>
