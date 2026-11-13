<script lang="ts">
  import Button from '../../components/Button.svelte'
  import EmptyState from '../../components/EmptyState.svelte'
  import LogbookRow from '../../components/LogbookRow.svelte'
  import { toCsv } from '../../core/backup/csv'
  import { localDate } from '../../core/calendar/dates'
  import { type BlockKind, blockKinds } from '../../core/model/schemas'
  import { type SubjectId, subjectName, subjects } from '../../core/model/subjects'
  import { bestHours, clarityBySubject, quizByChapter, totals } from '../../core/stats/stats'
  import { copy } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { describeBlock } from '../../lib/describe'
  import { live } from '../../lib/live.svelte'
  import { href } from '../../lib/nav'

  const today = localDate(Date.now())
  let subject = $state<SubjectId | 'all'>('all')
  let kind = $state<BlockKind | 'all'>('all')

  const data = live(async () => {
    const [sessions, chapters, exercises, simLessons] = await Promise.all([
      db.sessions.orderBy('startedAt').reverse().toArray(),
      db.chapters.orderBy('order').toArray(),
      db.exercises.toArray(),
      db.simLessons.toArray(),
    ])
    return { sessions, chapters, exercises, simLessons }
  }, null)

  const catalogue = $derived({
    chapters: data.value?.chapters ?? [],
    exercises: data.value?.exercises ?? [],
    simLessons: data.value?.simLessons ?? [],
  })
  const shown = $derived(
    (data.value?.sessions ?? []).filter(
      (s) => (subject === 'all' || s.subject === subject) && (kind === 'all' || s.kind === kind),
    ),
  )
  const t = $derived(totals(data.value?.sessions ?? [], data.value?.chapters ?? [], today))
  const best = $derived(bestHours(data.value?.sessions ?? []))
  const clarity = $derived(clarityBySubject(data.value?.sessions ?? []))
  const quizzes = $derived(quizByChapter(data.value?.sessions ?? []))

  function title(s: (typeof shown)[number]) {
    return describeBlock(
      {
        id: s.id,
        date: today,
        order: 0,
        window: 'evening',
        minutes: s.activeMinutes,
        kind: s.kind,
        mode: s.mode,
        ref: s.ref,
        pageFrom: null,
        pageTo: null,
        content: s.content,
        status: 'done',
        why: { code: 'extra', chapter: null, clarity: null, count: null },
        extra: false,
      },
      catalogue,
    )
  }

  function exportCsv() {
    const rows = shown.map((s) => {
      const d = title(s)
      return [
        localDate(s.startedAt),
        copy.kind[s.kind],
        d.title,
        s.content,
        s.activeMinutes,
        s.focus ? Math.round(s.focus.attention * 100) : null,
        s.clarity,
        s.quizScore ? `${s.quizScore.correct}/${s.quizScore.total}` : null,
        s.note,
      ]
    })
    const csv = toCsv(
      ['date', 'type', 'title', 'content', 'active_min', 'focus_pct', 'clarity', 'quiz', 'note'],
      rows,
    )
    const url = URL.createObjectURL(new File([csv], 'vector-logbook.csv', { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `vector-logbook-${today}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
</script>

<h1>{copy.logbook.title}</h1>

{#if !data.ready}
  <p role="status">{copy.app.loading}</p>
{:else if (data.value?.sessions.length ?? 0) === 0}
  <EmptyState title={copy.logbook.emptyTitle} body={copy.logbook.emptyBody}>
    {#snippet action()}<Button variant="primary" href={href('')}>{copy.session.goToday}</Button>{/snippet}
  </EmptyState>
{:else}
  <section aria-labelledby="totals-title">
    <h2 id="totals-title" class="visually-hidden">{copy.logbook.totals}</h2>
    <dl class="totals">
      <div><dt>{copy.logbook.hoursTotal}</dt><dd>{t.hoursTotal}<small> {copy.logbook.hoursUnit}</small></dd></div>
      <div><dt>{copy.logbook.hoursMonth}</dt><dd>{t.hoursMonth}<small> {copy.logbook.hoursUnit}</small></dd></div>
      <div><dt>{copy.logbook.hoursWeek}</dt><dd>{t.hoursWeek}<small> {copy.logbook.hoursUnit}</small></dd></div>
      <div><dt>{copy.logbook.simHours}</dt><dd>{t.simHours}<small> {copy.logbook.hoursUnit}</small></dd></div>
      <div><dt>{copy.logbook.chaptersDone}</dt><dd>{t.chaptersDone}<small> · {t.bookPercent}%</small></dd></div>
    </dl>
  </section>

  <div class="filters">
    <label>
      <span>{copy.logbook.filterSubject}</span>
      <select bind:value={subject}>
        <option value="all">{copy.logbook.all}</option>
        {#each subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </label>
    <label>
      <span>{copy.logbook.filterKind}</span>
      <select bind:value={kind}>
        <option value="all">{copy.logbook.all}</option>
        {#each blockKinds as k (k)}<option value={k}>{copy.kind[k]}</option>{/each}
      </select>
    </label>
    <Button variant="quiet" onclick={exportCsv}>{copy.logbook.exportCsv}</Button>
  </div>

  {#if shown.length === 0}
    <p class="muted">{copy.logbook.noMatch}</p>
  {:else}
    <ol class="logbook">
      {#each shown as s (s.id)}
        {@const d = title(s)}
        <LogbookRow
          date={localDate(s.startedAt)}
          kind={copy.kind[s.kind]}
          content={[d.title, s.content !== d.title ? s.content : '', s.quizScore ? `${s.quizScore.correct}/${s.quizScore.total}` : '', s.simOutcome ? copy.materials.sim[s.simOutcome] : ''].filter(Boolean).join(' · ')}
          activeMinutes={s.activeMinutes}
          focusPercent={s.focus ? Math.round(s.focus.attention * 100) : null}
          clarity={s.clarity}
          note={[s.note, s.simDeviations].filter(Boolean).join(' · ')}
        />
      {/each}
    </ol>
  {/if}

  <section class="stats" aria-labelledby="best-title">
    <h2 id="best-title">{copy.logbook.bestHours}</h2>
    {#if best.length === 0}
      <p class="muted">{copy.logbook.bestHoursEmpty}</p>
    {:else}
      <ul class="bars">
        {#each best as b (b.part)}
          <li>
            <span>{copy.logbook.dayPart[b.part]}</span>
            <span class="bar"><span style:width="{b.attention}%"></span></span>
            <span class="num">{b.attention}%</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if clarity.length > 0}
    <section class="stats" aria-labelledby="clarity-title">
      <h2 id="clarity-title">{copy.logbook.clarityTrend}</h2>
      <ul class="bars">
        {#each clarity as c (c.subject)}
          <li>
            <span>{subjectName(c.subject)}</span>
            <span class="dots" aria-label={c.ratings.join(', ')}>
              {#each c.ratings as r, i (i)}<span class="dot" style:height="{r * 20}%"></span>{/each}
            </span>
            <span class="num">{c.mean}/5</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if quizzes.length > 0}
    <section class="stats" aria-labelledby="quiz-title">
      <h2 id="quiz-title">{copy.logbook.quizScores}</h2>
      <ul class="bars">
        {#each quizzes as q (q.chapterId)}
          {@const c = data.value?.chapters.find((x) => x.id === q.chapterId)}
          <li>
            <span>{c ? `${c.order}. ${c.title}` : q.chapterId}</span>
            <span class="num wide">{q.scores.map((s) => `${s}%`).join(' → ')}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  .muted {
    color: var(--color-text-secondary);
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: var(--space-4);
    margin: 0;
  }

  .totals dt {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .totals dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xl);
  }

  .totals small {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
  }

  .filters label {
    display: grid;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  select {
    min-height: var(--target-min);
    max-width: 100%;
    padding: 0 var(--space-3);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
  }

  .logbook {
    margin: 0;
    padding: 0;
    border-top: var(--border-thick) solid var(--color-rule);
    background: var(--color-surface-raised);
  }

  .stats {
    display: grid;
    gap: var(--space-3);
  }

  .bars {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bars li {
    display: grid;
    grid-template-columns: minmax(7rem, 12rem) 1fr auto;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .bar {
    height: 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-accent-soft);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--color-accent);
  }

  .dots {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 1.5rem;
  }

  .dot {
    width: 0.375rem;
    border-radius: 1px;
    background: var(--color-accent);
  }

  .num {
    font-family: var(--font-mono);
  }

  .wide {
    grid-column: 2 / -1;
  }
</style>
