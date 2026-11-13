<script lang="ts">
  import { copy } from '../lib/copy'
  import ProgressBar from './ProgressBar.svelte'

  interface Progress {
    value: number
    max: number
    text: string
  }

  interface Props {
    title: string
    sentence: string
    /** Local date the milestone was reached (YYYY-MM-DD), or null for a next milestone. */
    reachedOn: string | null
    progress?: Progress
  }

  let { title, sentence, reachedOn, progress }: Props = $props()

  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const reachedLabel = $derived.by(() => {
    if (!reachedOn) return null
    const [y = 1970, m = 1, d = 1] = reachedOn.split('-').map(Number)
    return dateFormat.format(new Date(y, m - 1, d))
  })
</script>

<article class="milestone" class:reached={reachedOn}>
  <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
    <circle class="ring" cx="16" cy="16" r="12" />
    <circle class="dot" cx="19" cy="13" r="4" />
  </svg>
  <div class="body">
    <h3>{title}</h3>
    <p>{sentence}</p>
    {#if reachedOn && reachedLabel}
      <p class="when">{copy.milestone.reachedOn} <time datetime={reachedOn}>{reachedLabel}</time></p>
    {:else if progress}
      <ProgressBar
        value={progress.value}
        max={progress.max}
        label={copy.milestone.next}
        valueText={progress.text}
      />
    {/if}
  </div>
</article>

<style>
  .milestone {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-5);
    border: var(--border-thin) solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  .reached {
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-sm);
  }

  .mark {
    width: 2.5rem;
    height: 2.5rem;
  }

  .ring {
    fill: none;
    stroke: var(--color-border-strong);
    stroke-width: 2.5;
  }

  .dot {
    fill: none;
    stroke: var(--color-border-strong);
    stroke-width: 1.5;
  }

  .reached .ring {
    stroke: var(--color-accent);
  }

  .reached .dot {
    fill: var(--color-accent);
    stroke: var(--color-accent);
  }

  .body {
    display: grid;
    gap: var(--space-2);
  }

  .when {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
</style>
