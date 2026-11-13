<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    body: string
    action?: Snippet
    /** Heading level, so the outline stays in order wherever it sits. */
    level?: 2 | 3
  }

  let { title, body, action, level = 2 }: Props = $props()
</script>

<div class="empty">
  <svg class="lines" viewBox="0 0 96 40" aria-hidden="true">
    <line x1="0" y1="8" x2="96" y2="8" />
    <line x1="0" y1="20" x2="96" y2="20" />
    <line x1="0" y1="32" x2="96" y2="32" />
    <line class="column" x1="26" y1="0" x2="26" y2="40" />
  </svg>
  <svelte:element this={`h${level}`} class="title">{title}</svelte:element>
  <p>{body}</p>
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-5);
    border: var(--border-thin) dashed var(--color-rule);
    border-radius: var(--radius-lg);
  }

  .lines {
    width: 6rem;
    height: 2.5rem;
    margin-bottom: var(--space-2);
  }

  line {
    stroke: var(--color-rule);
    stroke-width: 1.5;
  }

  .column {
    stroke: var(--color-accent);
    stroke-opacity: 0.35;
  }

  .title {
    font-size: var(--text-md);
  }

  p {
    color: var(--color-text-secondary);
  }

  .action {
    margin-top: var(--space-2);
  }
</style>
