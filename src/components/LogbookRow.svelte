<script lang="ts">
  import { copy } from '../lib/copy'

  interface Props {
    /** Local calendar date, YYYY-MM-DD. */
    date: string
    kind: string
    content: string
    activeMinutes: number
    /** Attention share 0–100; null when the session ran without the camera. */
    focusPercent: number | null
    clarity: number | null
    note?: string
  }

  let { date, kind, content, activeMinutes, focusPercent, clarity, note }: Props = $props()

  const dayFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const label = $derived.by(() => {
    const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
    return dayFormat.format(new Date(y, m - 1, d))
  })
</script>

<li class="row">
  <time class="date" datetime={date}>{label}</time>
  <div class="main">
    <span class="kind">{kind}</span>
    <span class="content">{content}</span>
    {#if note}<span class="note">{note}</span>{/if}
  </div>
  <dl class="stats">
    <div>
      <dt class="visually-hidden">{copy.logbook.activeTimeLabel}</dt>
      <dd><span class="num">{activeMinutes}</span> {copy.logbook.minutes}</dd>
    </div>
    <div>
      <dt class="visually-hidden">{copy.logbook.focusLabel}</dt>
      <dd>
        {#if focusPercent === null}
          <span class="muted">{copy.logbook.noFocusData}</span>
        {:else}
          <span class="num">{focusPercent}%</span> {copy.logbook.focus}
        {/if}
      </dd>
    </div>
    {#if clarity !== null}
      <div>
        <dt class="visually-hidden">{copy.logbook.clarityLabel}</dt>
        <dd>{copy.logbook.clarity} <span class="num">{clarity}/5</span></dd>
      </div>
    {/if}
  </dl>
</li>

<style>
  /* Ruled like a paper logbook: faint blue column rules, one line per session. */
  .row {
    display: grid;
    grid-template-columns: 7.75rem minmax(0, 1fr) 8.5rem;
    border-bottom: var(--border-thin) solid var(--color-rule);
    list-style: none;
  }

  .row > * {
    padding: var(--space-3) var(--space-4);
  }

  .row > * + * {
    border-left: var(--border-thin) solid var(--color-rule);
  }

  .date {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .main {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .kind {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-accent);
  }

  .content {
    overflow-wrap: anywhere;
  }

  .note {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .stats {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  dd {
    margin: 0;
  }

  .num {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
  }

  .muted {
    font-style: italic;
  }

  @media (width < 40rem) {
    .row {
      grid-template-columns: 5.25rem minmax(0, 1fr);
    }

    .row > * {
      padding: var(--space-3);
    }

    .stats {
      grid-column: 2;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-4);
      padding-top: 0;
    }

    .row > .stats {
      border-left: var(--border-thin) solid var(--color-rule);
    }
  }
</style>
