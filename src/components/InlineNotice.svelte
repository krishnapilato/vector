<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    tone?: 'info' | 'success' | 'attention'
    title?: string
    /** Announce to screen readers when it appears (for notices shown after an action). */
    live?: boolean
    children: Snippet
    action?: Snippet
  }

  let { tone = 'info', title, live = false, children, action }: Props = $props()
</script>

<div class="notice {tone}" role={live ? 'status' : undefined}>
  <span class="bar" aria-hidden="true"></span>
  <div class="body">
    {#if title}<p class="title">{title}</p>{/if}
    <div class="text">{@render children()}</div>
  </div>
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
    border-radius: var(--radius-md);
  }

  .bar {
    align-self: stretch;
    width: 3px;
    border-radius: 2px;
  }

  .body {
    flex: 1 1 14rem;
    display: grid;
    gap: var(--space-1);
  }

  .title {
    font-weight: var(--font-weight-medium);
  }

  .text {
    font-size: var(--text-sm);
  }

  .info {
    background: var(--color-accent-soft);
  }

  .info .bar {
    background: var(--color-accent);
  }

  .success {
    background: var(--color-success-soft);
  }

  .success .bar {
    background: var(--color-success);
  }

  .attention {
    background: var(--color-attention-soft);
  }

  .attention .bar {
    background: var(--color-attention);
  }
</style>
