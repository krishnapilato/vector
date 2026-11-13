<script lang="ts">
  import Button from '../../components/Button.svelte'
  import EmptyState from '../../components/EmptyState.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import ProgressBar from '../../components/ProgressBar.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import { addDays, localDate, mondayOf, weekDates } from '../../core/calendar/dates'
  import { toIcs } from '../../core/calendar/ics'
  import type { Block } from '../../core/model/schemas'
  import { weightedPagesLeft } from '../../core/planner/content'
  import { type PlanResult, projectWeeks } from '../../core/planner/week'
  import { copy, formatLongDate, formatShortDay } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { describeBlock } from '../../lib/describe'
  import { live } from '../../lib/live.svelte'
  import { href } from '../../lib/nav'
  import { addBlock, applyPlan, getSettings, plannerInput, previewPlan } from '../../lib/repo'

  const today = localDate(Date.now())
  let view = $state<'week' | 'month'>('week')
  let monday = $state(mondayOf(today))
  let preview = $state<PlanResult | null>(null)
  let editing = $state<string | null>(null)
  let openWhy = $state<string | null>(null)
  let message = $state<string | null>(null)

  const data = live(async () => {
    const [blocks, chapters, exercises, simLessons, settings] = await Promise.all([
      db.blocks.where('date').between(monday, addDays(monday, 6), true, true).toArray(),
      db.chapters.orderBy('order').toArray(),
      db.exercises.toArray(),
      db.simLessons.orderBy('order').toArray(),
      getSettings(),
    ])
    return { blocks, chapters, exercises, simLessons, settings }
  }, null)

  const catalogue = $derived({
    chapters: data.value?.chapters ?? [],
    exercises: data.value?.exercises ?? [],
    simLessons: data.value?.simLessons ?? [],
  })
  const days = $derived(weekDates(monday))
  const byDay = (date: string) =>
    (data.value?.blocks ?? []).filter((b) => b.date === date).toSorted((a, b) => a.order - b.order)

  const month = live(async () => {
    const input = await plannerInput(today)
    return { weeks: projectWeeks(input, 5), left: weightedPagesLeft(input.chapters), input }
  }, null)

  const diff = $derived.by(() => {
    if (!preview || !data.value) return null
    const key = (b: Block) => `${b.date}|${b.kind}|${b.content}`
    const old = data.value.blocks.filter(
      (b) => b.status === 'planned' && !b.extra && b.date >= today,
    )
    const oldKeys = new Set(old.map(key))
    const newKeys = new Set(preview.blocks.map(key))
    return {
      removed: old.filter((b) => !newKeys.has(key(b))),
      added: preview.blocks.filter((b) => !oldKeys.has(key(b))),
    }
  })

  async function regenerate() {
    preview = await previewPlan(today)
    monday = mondayOf(today)
  }

  async function confirm() {
    if (!preview) return
    await applyPlan(today, preview)
    preview = null
    message = copy.plan.title
  }

  async function move(block: Block, date: string) {
    const order = byDay(date).length
    await addBlock({ ...$state.snapshot(block), date, order, status: 'planned' })
    editing = null
  }

  async function setMinutes(block: Block, minutes: number) {
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180) return
    await addBlock({ ...$state.snapshot(block), minutes: Math.round(minutes) })
  }

  async function remove(block: Block) {
    await db.blocks.delete(block.id)
    editing = null
  }

  async function exportIcs() {
    const from = today
    const blocks = await db.blocks
      .where('date')
      .between(from, addDays(mondayOf(today), 13), true, true)
      .filter((b) => b.status === 'planned')
      .toArray()
    const events = blocks.map((block) => {
      const d = describeBlock(block, catalogue)
      return {
        block,
        title: `Vector · ${copy.kind[block.kind]}: ${d.title}`,
        description: [d.detail, copy.why(block.why)].filter(Boolean).join('\n'),
      }
    })
    const file = new File([toIcs(events, Date.now())], `vector-plan-${from}.ics`, {
      type: 'text/calendar',
    })
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
</script>

<header class="head">
  <h1>{copy.plan.title}</h1>
  <SegmentedControl
    name="plan-view"
    legend={copy.plan.view}
    hideLegend
    options={[
      { value: 'week', label: copy.plan.week },
      { value: 'month', label: copy.plan.month },
    ]}
    bind:value={view}
  />
</header>

{#if !data.ready}
  <p class="muted" role="status">{copy.app.loading}</p>
{:else if !data.value?.settings.onboarded}
  <EmptyState title={copy.plan.title} body={copy.empty.plan}>
    {#snippet action()}<Button variant="primary" href={href('welcome')}>{copy.welcome.title}</Button>{/snippet}
  </EmptyState>
{:else if view === 'week'}
  <div class="toolbar">
    <Button variant="quiet" onclick={() => (monday = addDays(monday, -7))}>← {copy.plan.previous}</Button>
    <span class="range">{formatShortDay(monday)} – {formatShortDay(addDays(monday, 6))}</span>
    <Button variant="quiet" onclick={() => (monday = addDays(monday, 7))}>{copy.plan.next} →</Button>
  </div>

  {#if message}<InlineNotice tone="success" live>{copy.today.planUpdated}</InlineNotice>{/if}

  <ol class="days">
    {#each days as date (date)}
      <li class="day" class:today={date === today}>
        <h2>{formatShortDay(date)}</h2>
        {#if byDay(date).length === 0}
          <p class="muted small">{copy.plan.empty}</p>
        {:else}
          <ul class="blocks">
            {#each byDay(date) as block (block.id)}
              {@const d = describeBlock(block, catalogue)}
              <li class="block {block.status}">
                <div class="info">
                  <p class="meta">
                    {copy.kind[block.kind]} · {copy.block.minutes(block.minutes)} · {copy.window[block.window]}
                    {#if block.status !== 'planned'}· {copy.plan.status[block.status]}{/if}
                  </p>
                  <p>{d.title}</p>
                  {#if d.detail}<p class="detail">{d.detail}</p>{/if}
                  {#if openWhy === block.id}<p class="why">{copy.why(block.why)}</p>{/if}
                </div>
                <div class="block-actions">
                  <Button variant="quiet" onclick={() => (openWhy = openWhy === block.id ? null : block.id)}>{copy.today.why}</Button>
                  {#if block.status === 'planned'}
                    <Button variant="quiet" onclick={() => (editing = editing === block.id ? null : block.id)}>{copy.materials.edit}</Button>
                  {/if}
                </div>
                {#if editing === block.id}
                  <div class="edit">
                    <label>
                      <span>{copy.plan.move}</span>
                      <select value={block.date} onchange={(e) => void move(block, e.currentTarget.value)}>
                        {#each days.filter((x) => x >= today) as option (option)}
                          <option value={option}>{formatShortDay(option)}</option>
                        {/each}
                      </select>
                    </label>
                    <label>
                      <span>{copy.plan.minutes}</span>
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={block.minutes}
                        onchange={(e) => void setMinutes(block, Number(e.currentTarget.value))}
                      />
                    </label>
                    <Button variant="quiet" onclick={() => void remove(block)}>{copy.plan.remove}</Button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ol>

  <div class="footer">
    <Button onclick={regenerate}>{copy.plan.regenerate}</Button>
    <Button variant="quiet" onclick={exportIcs}>{copy.plan.exportIcs}</Button>
  </div>
  <p class="muted small">{copy.plan.exportHint}</p>

  {#if preview && diff}
    <section class="preview" aria-labelledby="preview-title">
      <h2 id="preview-title">{copy.plan.regenerateTitle}</h2>
      {#if diff.added.length === 0 && diff.removed.length === 0}
        <p>{copy.plan.noChange}</p>
      {:else}
        <p>{copy.plan.regenerateBody}</p>
        <ul class="changes">
          {#each diff.removed as b (b.id)}<li class="out">{copy.plan.removed}: {formatShortDay(b.date)} · {copy.kind[b.kind]} · {describeBlock(b, catalogue).title} {b.content}</li>{/each}
          {#each diff.added as b (b.id)}<li class="in">{copy.plan.added}: {formatShortDay(b.date)} · {copy.kind[b.kind]} · {describeBlock(b, catalogue).title} {b.content}</li>{/each}
        </ul>
      {/if}
      {#each preview.notes as note}<p class="small">{copy.note(note)}</p>{/each}
      <div class="footer">
        <Button variant="quiet" onclick={() => (preview = null)}>{copy.plan.cancel}</Button>
        <Button variant="primary" onclick={confirm}>{copy.plan.regenerateConfirm}</Button>
      </div>
    </section>
  {/if}
{:else if month.value}
  {@const finish = month.value.input.settings.targetDate}
  {#each month.value.weeks as w (w.monday)}
    <section class="week-row">
      <h2>{formatShortDay(w.monday)} – {formatShortDay(addDays(w.monday, 6))}</h2>
      <p class="meta">{copy.plan.monthLoad(w.blocks)}</p>
      <p class="small">
        {copy.plan.monthChapters}:
        {w.chapters.length > 0
          ? w.chapters
              .map((id) => month.value?.input.chapters.find((c) => c.id === id))
              .map((c) => (c ? `${c.order}. ${c.title}` : ''))
              .join(' · ')
          : copy.plan.monthNone}
      </p>
    </section>
  {/each}
  {@const total = month.value.input.chapters.length}
  {@const done = month.value.input.chapters.filter((c) => c.completedOn !== null).length}
  <ProgressBar value={done} max={Math.max(1, total)} label={copy.materials.book} valueText={copy.milestone.progress.chapters(done, total)} />
  {#if finish}<p class="small muted">{copy.settings.targetDate}: {formatLongDate(finish)}</p>{/if}
{/if}

<style>
  .head {
    display: grid;
    gap: var(--space-4);
  }

  .muted,
  .meta,
  .detail {
    color: var(--color-text-secondary);
  }

  .small,
  .meta {
    font-size: var(--text-sm);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .range {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-align: center;
  }

  .days,
  .blocks,
  .changes {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .day {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    border-bottom: var(--border-thin) solid var(--color-rule);
  }

  .day h2 {
    font-size: var(--text-md);
  }

  .day.today h2 {
    color: var(--color-accent);
  }

  .block {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: var(--border-thin) solid var(--color-border);
  }

  .block + .block {
    margin-top: var(--space-2);
  }

  .block.done .info > p:nth-child(2) {
    text-decoration: line-through;
    text-decoration-color: var(--color-border-strong);
  }

  .block.skipped,
  .block.moved {
    opacity: 0.7;
  }

  .block-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
  }

  .why {
    margin-top: var(--space-2);
    padding-left: var(--space-3);
    border-left: var(--border-thick) solid var(--color-rule);
    font-size: var(--text-sm);
  }

  .edit {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
  }

  .edit label {
    display: grid;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  .edit select,
  .edit input {
    min-height: var(--target-min);
    padding: 0 var(--space-3);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
  }

  .edit input {
    width: 6rem;
    font-family: var(--font-mono);
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .preview {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-md);
  }

  .changes {
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  .changes .in {
    color: var(--color-success);
  }

  .week-row {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3) 0;
    border-bottom: var(--border-thin) solid var(--color-rule);
  }

  .week-row h2 {
    font-size: var(--text-md);
  }
</style>
