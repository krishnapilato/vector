<!--
  The Logbook (PIANO-V3-LITE §4.2): totals at the top, then every session, newest first,
  with a quick filter and a CSV export.
-->
<script lang="ts">
  import Button from '../../components/Button.svelte'
  import Loading from '../../components/Loading.svelte'
  import TextField from '../../components/TextField.svelte'
  import { sessionsCsv } from '../../core/export/export'
  import { totals, weekStart } from '../../core/session/totals'
  import { download } from '../../lib/backup'
  import { copy, formatDateTime } from '../../lib/copy'
  import { live } from '../../lib/live.svelte'
  import { listSessions } from '../../lib/store'

  let filter = $state<string | number | null>('')

  const sessions = live(listSessions, [])

  const query = $derived(
    String(filter ?? '')
      .trim()
      .toLowerCase(),
  )
  const shown = $derived(
    query
      ? sessions.value.filter((s) => `${s.tag} ${s.note}`.toLowerCase().includes(query))
      : sessions.value,
  )
  const sum = $derived(totals(sessions.value, weekStart(new Date())))

  function exportCsv() {
    const day = new Date().toISOString().slice(0, 10)
    download(
      new File([sessionsCsv(sessions.value)], `vector-logbook-${day}.csv`, { type: 'text/csv' }),
    )
  }
</script>

<div class="page-heading">
  <h1>{copy.logbook.title}</h1>
  {#if sessions.ready && sessions.value.length > 0}
    <Button onclick={exportCsv}>Export CSV <span aria-hidden="true">↗</span></Button>
  {/if}
</div>

{#if !sessions.ready}
  <Loading />
{:else}
  <dl class="totals" aria-label="Session statistics">
    <div class="hero">
      <dt>{copy.logbook.weekHours}</dt>
      <dd>{sum.weekHours}<small>{copy.logbook.hoursUnit}</small></dd>
    </div>
    <div>
      <dt>{copy.logbook.weekSessions}</dt>
      <dd>{sum.weekSessions}</dd>
    </div>
    <div>
      <dt>{copy.logbook.averageFocus}</dt>
      <dd>{sum.averageFocusPct === null ? '—' : sum.averageFocusPct}{#if sum.averageFocusPct !== null}<small>%</small>{/if}</dd>
    </div>
    <div>
      <dt>{copy.logbook.allTime}</dt>
      <dd>{sum.totalHours}<small>{copy.logbook.hoursUnit}</small></dd>
    </div>
  </dl>

  <section class="entries" aria-labelledby="entries-title">
    <div class="entries-heading">
      <h2 id="entries-title">Session history</h2>
      <span class="count">{sessions.value.length} {sessions.value.length === 1 ? 'session' : 'sessions'}</span>
    </div>
    {#if sessions.value.length === 0}
      <div class="empty">
        <span class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h12v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h6m-6 4h6m-6 4h3" /></svg></span>
        <h3>A little focus adds up.</h3>
        <p>{copy.logbook.empty}</p>
        <Button variant="primary" href={import.meta.env.BASE_URL}>Start a session <span aria-hidden="true">↗</span></Button>
      </div>
    {:else}
      <div class="tools">
        <TextField label={copy.logbook.filter} placeholder="Search tasks and notes…" bind:value={filter} />
        {#if query}<Button variant="quiet" onclick={() => (filter = '')}>Clear</Button>{/if}
      </div>
      {#if query}<p class="results" role="status">{shown.length} of {sessions.value.length} sessions</p>{/if}
      {#if shown.length === 0}
        <div class="empty compact">
          <h3>No matching sessions.</h3>
          <p>Try another task name or a word from your notes.</p>
          <Button onclick={() => (filter = '')}>Clear filter</Button>
        </div>
      {:else}
        <ol class="list">
          {#each shown as s (s.id)}
            <li class="row">
              <div class="session-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 1.5M10 2h4" /></svg></div>
              <div class="main">
                <p class="when"><time datetime={new Date(s.startedAt).toISOString()}>{formatDateTime(s.startedAt)}</time></p>
                <h3 class="tag">{s.tag || copy.logbook.untitled}</h3>
                {#if s.note}<p class="note">{s.note}</p>{/if}
                <div class="metadata">
                  {#if s.focusAggregates}
                    <span>{copy.logbook.focus(s.focusAggregates.focusScorePct)}</span>
                    <span>{copy.logbook.fatigue(s.focusAggregates.fatigueEvents)}</span>
                  {:else}
                    <span>{copy.logbook.noCamera}</span>
                  {/if}
                </div>
              </div>
              <div class="stats">
                <span class="minutes">{copy.logbook.minutes(Math.round(s.activeSeconds / 60))}</span>
                <span class="rating" aria-label="Clarity: {s.clarityRating} out of 5"><span aria-hidden="true">☆</span> {copy.logbook.rating(s.clarityRating)}</span>
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .page-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
  .totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin: 0; }
  .totals > div { display: flex; flex-direction: column-reverse; justify-content: end; gap: var(--space-4); padding: var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-raised); }
  .totals .hero { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent); }
  dt { font-size: var(--text-xs); color: var(--color-text-secondary); }
  .hero dt, .hero small { color: var(--color-on-accent); }
  dd { margin: 0; font-size: clamp(1.75rem, 3vw, 2.5rem); font-weight: 500; letter-spacing: -0.05em; line-height: 1; }
  small { margin-left: 0.15em; font-size: 0.45em; letter-spacing: 0; color: var(--color-text-secondary); }
  .entries { overflow: hidden; min-width: 0; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  .entries-heading { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-5); border-bottom: 1px solid var(--color-border); }
  .entries-heading h2 { font-size: var(--text-md); }
  .count { padding: 0.25rem 0.625rem; background: var(--color-fill); color: var(--color-text-secondary); border-radius: var(--radius-pill); font-size: var(--text-xs); white-space: nowrap; }
  .tools { display: flex; align-items: end; gap: var(--space-3); padding: var(--space-5); }
  .tools :global(.field) { flex: 1; }
  .results { padding: 0 var(--space-5) var(--space-4); color: var(--color-text-secondary); font-size: var(--text-xs); }
  .list { margin: 0; padding: 0; list-style: none; }
  .row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: var(--space-4); padding: var(--space-5); border-top: 1px solid var(--color-border); transition: background-color var(--duration-fast) var(--ease); }
  .row:hover { background: var(--color-surface); }
  .session-mark, .empty-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-fill); color: var(--color-accent); }
  svg { width: 1.375rem; height: 1.375rem; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .main { display: grid; gap: var(--space-1); min-width: 0; }
  .when, .metadata { color: var(--color-text-secondary); font-size: var(--text-xs); }
  .tag { font-size: var(--text-md); font-weight: 500; overflow-wrap: anywhere; }
  .note { margin-block: var(--space-1); color: var(--color-text-secondary); font-size: var(--text-sm); overflow-wrap: anywhere; }
  .metadata { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); margin-top: var(--space-2); }
  .stats { display: grid; justify-items: end; gap: var(--space-2); }
  .minutes { font-weight: 600; white-space: nowrap; }
  .rating { display: flex; align-items: center; gap: var(--space-1); color: var(--color-text-secondary); font-size: var(--text-xs); }
  .empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: clamp(2rem, 5vw, 4rem) var(--space-5); text-align: center; }
  .empty h3 { font-size: var(--text-lg); }
  .empty p { max-width: 36ch; font-size: var(--text-sm); color: var(--color-text-secondary); }
  .empty-icon { width: 3.5rem; height: 3.5rem; margin-bottom: var(--space-2); }
  .empty-icon svg { width: 1.75rem; height: 1.75rem; }
  .compact { border-top: 1px solid var(--color-border); }
  @media (width < 40rem) {
    .totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .totals > div { padding: var(--space-4); }
    .page-heading { flex-wrap: wrap; }
    .row { grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-3); }
    .session-mark { display: none; }
  }
</style>
