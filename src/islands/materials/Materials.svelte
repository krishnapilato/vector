<script lang="ts">
  import Button from '../../components/Button.svelte'
  import EmptyState from '../../components/EmptyState.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import TextField from '../../components/TextField.svelte'
  import { localDate } from '../../core/calendar/dates'
  import type { Chapter, Difficulty, Exercise } from '../../core/model/schemas'
  import { type SubjectId, subjectName, subjects } from '../../core/model/subjects'
  import { dueReviews } from '../../core/planner/content'
  import { copy } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { live } from '../../lib/live.svelte'
  import { href } from '../../lib/nav'
  import { getSettings } from '../../lib/repo'

  const today = localDate(Date.now())
  let tab = $state<'book' | 'exercises' | 'simulator'>('book')
  let editing = $state<string | null>(null)
  let draft = $state<Chapter | null>(null)
  let exerciseDraft = $state<Exercise | null>(null)

  const data = live(async () => {
    const [chapters, exercises, simLessons, sessions, settings] = await Promise.all([
      db.chapters.orderBy('order').toArray(),
      db.exercises.toArray(),
      db.simLessons.orderBy('order').toArray(),
      db.sessions.toArray(),
      getSettings(),
    ])
    const toReview = new Set(
      dueReviews(chapters, sessions)
        .filter((r) => r.due <= today)
        .map((r) => r.chapter.id),
    )
    return { chapters, exercises, simLessons, settings, toReview }
  }, null)

  function status(c: Chapter) {
    if (data.value?.toReview.has(c.id)) return copy.materials.status.review
    return copy.materials.status[c.status]
  }

  function percent(c: Chapter) {
    if (c.completedOn) return 100
    if (c.pageReached === null) return 0
    return Math.round(((c.pageReached - c.pageStart + 1) / (c.pageEnd - c.pageStart + 1)) * 100)
  }

  const pageProblem = $derived(
    draft && draft.pageEnd < draft.pageStart ? copy.materials.pageOrderProblem : undefined,
  )

  function edit(c: Chapter) {
    editing = c.id
    draft = { ...c }
  }

  async function saveChapter() {
    if (!draft || pageProblem || !draft.title.trim()) return
    await db.chapters.put({ ...$state.snapshot(draft), title: draft.title.trim() } as Chapter)
    editing = null
    draft = null
  }

  async function saveExercise() {
    if (!exerciseDraft) return
    await db.exercises.put($state.snapshot(exerciseDraft) as Exercise)
    exerciseDraft = null
  }

  const num = (v: string | number | null, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) && v !== '' && v !== null ? Math.round(n) : fallback
  }
</script>

<h1>{copy.materials.title}</h1>

<SegmentedControl
  name="materials-tab"
  legend={copy.materials.title}
  hideLegend
  options={[
    { value: 'book', label: copy.materials.book },
    { value: 'exercises', label: copy.materials.exercises },
    { value: 'simulator', label: copy.materials.simulator },
  ]}
  bind:value={tab}
/>

{#if !data.ready}
  <p role="status">{copy.app.loading}</p>
{:else if (data.value?.chapters.length ?? 0) === 0}
  <EmptyState title={copy.materials.title} body={copy.materials.empty}>
    {#snippet action()}<Button variant="primary" href={href('welcome')}>{copy.welcome.title}</Button>{/snippet}
  </EmptyState>
{:else if data.value && tab === 'book'}
  <p class="muted small">{copy.materials.edition}: {data.value.settings.bookEdition}</p>
  {#if /provvisorio/i.test(data.value.settings.bookEdition)}
    <InlineNotice tone="attention">{copy.welcome.provisional}</InlineNotice>
  {/if}
  <ol class="list">
    {#each data.value.chapters as c (c.id)}
      <li class="item">
        {#if editing === c.id && draft}
          <form class="form" onsubmit={(e) => { e.preventDefault(); void saveChapter() }}>
            <TextField label={copy.materials.titleField} bind:value={draft.title} />
            <label class="field">
              <span>{copy.materials.subjectField}</span>
              <select bind:value={draft.subject}>
                {#each subjects as s (s.id)}<option value={s.id as SubjectId}>{s.name}</option>{/each}
              </select>
            </label>
            <div class="pair">
              <TextField label={copy.materials.firstPage} type="number" inputmode="numeric" value={draft.pageStart} oninput={(v) => draft && (draft.pageStart = num(v, draft.pageStart))} />
              <TextField label={copy.materials.lastPage} type="number" inputmode="numeric" value={draft.pageEnd} oninput={(v) => draft && (draft.pageEnd = num(v, draft.pageEnd))} {...pageProblem ? { invalid: pageProblem } : {}} />
            </div>
            <SegmentedControl
              name="difficulty-{c.id}"
              legend={copy.materials.difficulty}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
              ]}
              value={String(draft.difficulty) as '1' | '2' | '3'}
              onchange={(v) => draft && (draft.difficulty = Number(v) as Difficulty)}
            />
            <div class="actions">
              <Button variant="quiet" onclick={() => { editing = null; draft = null }}>{copy.materials.cancel}</Button>
              <Button variant="primary" type="submit">{copy.materials.save}</Button>
            </div>
          </form>
        {:else}
          <span class="num">{c.order}</span>
          <div class="body">
            <p>{c.title}</p>
            <p class="muted small">
              {subjectName(c.subject)} · {copy.materials.pages(c.pageStart, c.pageEnd)} · {copy.materials.difficulty} {c.difficulty}
            </p>
            <p class="small"><span class="status">{status(c)}</span>{#if c.status === 'in-progress'} · <span class="mono">{percent(c)}%</span>{/if}{#if c.lastClarity} · {copy.logbook.clarity} <span class="mono">{c.lastClarity}/5</span>{/if}</p>
          </div>
          <Button variant="quiet" onclick={() => edit(c)}>{copy.materials.edit}</Button>
        {/if}
      </li>
    {/each}
  </ol>
{:else if data.value && tab === 'exercises'}
  <ul class="list">
    {#each data.value.exercises as e (e.id)}
      <li class="item">
        {#if exerciseDraft?.id === e.id}
          <form class="form" onsubmit={(ev) => { ev.preventDefault(); void saveExercise() }}>
            <TextField label={copy.materials.titleField} bind:value={exerciseDraft.title} />
            <TextField label={copy.materials.source} bind:value={exerciseDraft.source} />
            <TextField label={copy.materials.perWeekLabel} type="number" inputmode="numeric" value={exerciseDraft.perWeek} suffix={copy.materials.perWeekUnit} oninput={(v) => exerciseDraft && (exerciseDraft.perWeek = Math.min(7, Math.max(0, num(v, exerciseDraft.perWeek))))} />
            <div class="actions">
              <Button variant="quiet" onclick={() => (exerciseDraft = null)}>{copy.materials.cancel}</Button>
              <Button variant="primary" type="submit">{copy.materials.save}</Button>
            </div>
          </form>
        {:else}
          <div class="body">
            <p>{e.title}</p>
            <p class="muted small">{copy.materials.source}: {e.source} · {subjectName(e.subject)} · {copy.materials.perWeek(e.perWeek)}</p>
          </div>
          <Button variant="quiet" onclick={() => (exerciseDraft = { ...e })}>{copy.materials.edit}</Button>
        {/if}
      </li>
    {/each}
  </ul>
{:else if data.value}
  <ol class="list">
    {#each data.value.simLessons as l (l.id)}
      <li class="item">
        <span class="num">{l.order}</span>
        <div class="body">
          <p>{l.title}</p>
          <p class="small"><span class="status">{copy.materials.sim[l.status]}</span> · {copy.materials.attempts(l.attempts)}</p>
          <p class="muted small">{l.objectives.join(' · ')}</p>
          <p class="muted small mono">{l.tolerances.join(' · ')}</p>
        </div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .muted {
    color: var(--color-text-secondary);
  }

  .small {
    font-size: var(--text-sm);
  }

  .mono,
  .num {
    font-family: var(--font-mono);
  }

  .num {
    color: var(--color-text-secondary);
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: var(--border-thin) solid var(--color-rule);
  }

  .item {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: var(--border-thin) solid var(--color-rule);
  }

  ul.list .item {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .body {
    display: grid;
    gap: 2px;
  }

  .status {
    font-weight: var(--font-weight-medium);
    color: var(--color-accent);
  }

  .form {
    grid-column: 1 / -1;
    display: grid;
    gap: var(--space-4);
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .field {
    display: grid;
    gap: var(--space-2);
    font-weight: var(--font-weight-medium);
  }

  select {
    min-height: var(--target-min);
    padding: 0 var(--space-3);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font-weight: var(--font-weight-regular);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
