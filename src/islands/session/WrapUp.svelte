<script lang="ts">
  import Button from '../../components/Button.svelte'
  import Card from '../../components/Card.svelte'
  import MilestoneCard from '../../components/MilestoneCard.svelte'
  import ScaleChoice from '../../components/ScaleChoice.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import TextField from '../../components/TextField.svelte'
  import { evaluateMilestones } from '../../core/milestones/milestones'
  import type { ActiveSession, Chapter, Clarity, Milestone } from '../../core/model/schemas'
  import { activeMinutes } from '../../core/session/timer'
  import { estimatePage } from '../../core/session/wrapup'
  import { copy } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { describeBlock } from '../../lib/describe'
  import { go, href } from '../../lib/nav'
  import { type FinishResult, finishSession, getActive, weeklyGoal } from '../../lib/repo'

  let active = $state<ActiveSession | null>(null)
  let chapter = $state<Chapter | null>(null)
  let loaded = $state(false)
  let saving = $state(false)
  let result = $state<FinishResult | null>(null)
  let milestoneCards = $state<{ id: string; title: string; sentence: string; reachedOn: string }[]>(
    [],
  )
  let title = $state('')

  let clarity = $state(3)
  let page = $state<string | number | null>(null)
  let note = $state('')
  let correct = $state<string | number | null>(null)
  let total = $state<string | number | null>(20)
  let outcome = $state<'passed' | 'repeat'>('passed')
  let deviations = $state('')
  let flown = $state<string | number | null>(null)
  let clean = $state<'yes' | 'no'>('no')

  $effect(() => {
    void (async () => {
      const a = await getActive()
      if (!a) {
        loaded = true
        return
      }
      active = a
      const [chapters, exercises, simLessons] = await Promise.all([
        db.chapters.toArray(),
        db.exercises.toArray(),
        db.simLessons.toArray(),
      ])
      const d = describeBlock(a.block, { chapters, exercises, simLessons })
      title = d.title
      chapter = d.chapter
      if (chapter?.lastClarity) clarity = chapter.lastClarity
      page = estimatePage(a, Date.now())
      flown = Math.max(1, Math.round((Date.now() - a.timer.startedAt) / 60_000))
      loaded = true
    })()
  })

  const kind = $derived(active?.block.kind)
  const num = (v: string | number | null) => (v === null || v === '' ? null : Number(v))
  const pageProblem = $derived.by(() => {
    const p = num(page)
    if (!chapter || p === null) return undefined
    return p < chapter.pageStart || p > chapter.pageEnd
      ? `${chapter.title}: ${copy.materials.pages(chapter.pageStart, chapter.pageEnd)}`
      : undefined
  })

  async function save() {
    if (!active || saving) return
    saving = true
    const c = num(correct)
    const t = num(total)
    const p = num(page)
    const r = await finishSession(
      $state.snapshot(active) as ActiveSession,
      {
        clarity: kind === 'simulator' ? null : (clarity as Clarity),
        pageReached: kind === 'reading' && p !== null && !pageProblem ? Math.round(p) : null,
        note,
        quizScore:
          kind === 'quiz' && c !== null && t !== null && t >= 1 && c >= 0 && c <= t
            ? { correct: Math.round(c), total: Math.round(t) }
            : null,
        simOutcome: kind === 'simulator' ? outcome : null,
        simDeviations: deviations,
        exerciseClean: kind === 'exercise' ? clean === 'yes' : null,
        minutesOverride: kind === 'simulator' ? Math.max(1, Math.round(num(flown) ?? 1)) : null,
      },
      active.focus,
    )
    milestoneCards = await describeMilestones(r.newMilestones)
    result = r
    saving = false
  }

  async function describeMilestones(list: Milestone[]) {
    if (list.length === 0) return []
    const [sessions, chapters, simLessons, exercises] = await Promise.all([
      db.sessions.toArray(),
      db.chapters.toArray(),
      db.simLessons.toArray(),
      db.exercises.toArray(),
    ])
    const all = evaluateMilestones({
      sessions,
      chapters,
      simLessons,
      exercises,
      weeklyGoal: await weeklyGoal(),
    })
    return list.flatMap((m) => {
      const def = all.find((x) => x.id === m.id)
      return def
        ? [{ id: m.id, title: def.title, sentence: def.sentence, reachedOn: m.reachedOn }]
        : []
    })
  }
</script>

{#if !loaded}
  <p class="muted" role="status">{copy.app.loading}</p>
{:else if result}
  <Card as="section" elevation="raised" labelledby="done-title">
    <h1 id="done-title" class="feedback" role="status">
      {copy.wrapUp.feedback(
        result.feedback.minutes,
        result.feedback.attention,
        result.feedback.chapterOrder,
        result.feedback.chapterPercent,
      )}
    </h1>
    <Button variant="primary" size="lg" full onclick={() => go('')}>{copy.wrapUp.backToToday}</Button>
  </Card>
  {#each milestoneCards as m (m.id)}
    <MilestoneCard title={m.title} sentence={m.sentence} reachedOn={m.reachedOn} />
  {/each}
{:else if !active}
  <p>{copy.session.noActive}</p>
  <div><Button href={href('')}>{copy.session.goToday}</Button></div>
{:else}
  <header class="head">
    <h1>{copy.wrapUp.title}</h1>
    <p class="muted">{title} · {activeMinutes(active.timer, Date.now())} {copy.logbook.minutes}</p>
  </header>

  <form class="form" onsubmit={(e) => { e.preventDefault(); void save() }}>
    {#if kind !== 'simulator'}
      <ScaleChoice name="clarity" bind:value={clarity} legend={copy.wrapUp.clarity} />
    {/if}

    {#if kind === 'reading'}
      <TextField label={copy.wrapUp.page} type="number" inputmode="numeric" bind:value={page} {...pageProblem ? { invalid: pageProblem } : {}} />
    {/if}

    {#if kind === 'quiz'}
      <fieldset class="pair">
        <legend>{copy.wrapUp.quiz}</legend>
        <TextField label={copy.wrapUp.quizCorrect} type="number" inputmode="numeric" bind:value={correct} min={0} />
        <TextField label={copy.wrapUp.quizTotal} type="number" inputmode="numeric" bind:value={total} min={1} />
      </fieldset>
    {/if}

    {#if kind === 'simulator'}
      <SegmentedControl
        name="outcome"
        legend={copy.wrapUp.simOutcome}
        options={[
          { value: 'passed', label: copy.wrapUp.simPassed },
          { value: 'repeat', label: copy.wrapUp.simRepeat },
        ]}
        bind:value={outcome}
      />
      <TextField label={copy.wrapUp.simDeviations} bind:value={deviations} />
      <TextField label={copy.wrapUp.simMinutes} type="number" inputmode="numeric" bind:value={flown} min={1} />
    {/if}

    {#if kind === 'exercise'}
      <SegmentedControl
        name="clean"
        legend={copy.wrapUp.exerciseClean}
        options={[
          { value: 'yes', label: copy.wrapUp.yes },
          { value: 'no', label: copy.wrapUp.no },
        ]}
        bind:value={clean}
      />
    {/if}

    <TextField label={copy.wrapUp.note} bind:value={note} placeholder={copy.wrapUp.notePlaceholder} />

    <Button variant="primary" size="lg" full type="submit" disabled={saving}>{copy.wrapUp.save}</Button>
  </form>
{/if}

<style>
  .head {
    display: grid;
    gap: var(--space-1);
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .form {
    display: grid;
    gap: var(--space-5);
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .pair legend {
    padding: 0;
    margin-bottom: var(--space-2);
    font-weight: var(--font-weight-medium);
  }

  .feedback {
    font-size: var(--text-lg);
    line-height: var(--leading-body);
  }
</style>
