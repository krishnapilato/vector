<script lang="ts">
  import Button from '../../components/Button.svelte'
  import Card from '../../components/Card.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import { localDate, mondayOf } from '../../core/calendar/dates'
  import type { Feeling } from '../../core/model/schemas'
  import { reviewDue, weekSummary } from '../../core/stats/stats'
  import { copy, formatShortDay } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { live } from '../../lib/live.svelte'
  import { href } from '../../lib/nav'
  import { saveWeeklyReview } from '../../lib/repo'

  const today = localDate(Date.now())
  let feeling = $state<Feeling>('right')
  let saved = $state<Feeling | null>(null)

  const data = live(async () => {
    const [sessions, chapters, exercises, simLessons, reviews] = await Promise.all([
      db.sessions.toArray(),
      db.chapters.toArray(),
      db.exercises.toArray(),
      db.simLessons.toArray(),
      db.weeklyReviews.toArray(),
    ])
    const week =
      reviewDue(
        today,
        reviews.map((r) => r.week),
      ) ?? mondayOf(today)
    return { summary: weekSummary(sessions, chapters, week), chapters, exercises, simLessons, week }
  }, null)

  async function save() {
    if (!data.value) return
    await saveWeeklyReview(data.value.week, feeling)
    saved = feeling
  }
</script>

<header class="head">
  <h1>{copy.week.title}</h1>
  <p class="muted">{copy.week.intro}</p>
</header>

{#if data.value}
  {@const s = data.value.summary}
  <Card as="section" labelledby="summary">
    <h2 id="summary" class="range">{formatShortDay(s.monday)}</h2>
    {#if s.blocksDone === 0}
      <p>{copy.week.nothing}</p>
    {:else}
      <dl class="stats">
        <div><dt>{copy.week.blocks}</dt><dd>{s.blocksDone}</dd></div>
        <div><dt>{copy.week.hours}</dt><dd>{s.activeHours}</dd></div>
        <div><dt>{copy.week.pages}</dt><dd>{s.pagesRead}</dd></div>
        <div><dt>{copy.week.chapters}</dt><dd>{s.chaptersFinished}</dd></div>
      </dl>
      {#if s.best}
        <p class="best">
          <span class="muted">{copy.week.best}:</span>
          {formatShortDay(localDate(s.best.startedAt))}, {copy.kind[s.best.kind]} · {s.best.content}
          · {s.best.activeMinutes} {copy.logbook.minutes}{s.best.focus ? `, ${Math.round(s.best.focus.attention * 100)}% ${copy.logbook.focus}` : ''}
        </p>
      {/if}
    {/if}
  </Card>

  {#if saved}
    <InlineNotice tone="success" live title={copy.week.done}>{copy.week.result[saved]}</InlineNotice>
    <div><Button href={href('')}>{copy.session.goToday}</Button></div>
  {:else}
    <SegmentedControl
      name="feeling"
      legend={copy.week.howWasIt}
      options={[
        { value: 'heavy', label: copy.week.feelings.heavy },
        { value: 'right', label: copy.week.feelings.right },
        { value: 'light', label: copy.week.feelings.light },
      ]}
      bind:value={feeling}
    />
    <p class="muted">{copy.week.result[feeling]}</p>
    <div><Button variant="primary" onclick={save}>{copy.week.save}</Button></div>
  {/if}
{/if}

<style>
  .head {
    display: grid;
    gap: var(--space-1);
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .range {
    font-family: var(--font-mono);
    font-size: var(--text-md);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--space-4);
    margin: 0;
  }

  .stats dt {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .stats dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xl);
  }
</style>
