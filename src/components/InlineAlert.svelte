<!--
  A calm message in the flow of the page: a soft tinted surface with a small coloured dot.
  Never red, never shouting (PIANO-V3-LITE §6.1).
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    tone?: 'info' | 'success' | 'attention'
    title?: string
    /** Announce to screen readers when it appears (for messages shown after an action). */
    live?: boolean
    children: Snippet
    action?: Snippet
  }

  let { tone = 'info', title, live = false, children, action }: Props = $props()
</script>

<div class="alert {tone}" role={live ? 'status' : undefined}>
  <span class="dot" aria-hidden="true"></span>
  <div class="body">
    {#if title}<p class="title">{title}</p>{/if}
    <div class="text">{@render children()}</div>
  </div>
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-lg);
  }

  .dot {
    flex: none;
    align-self: flex-start;
    width: 0.5rem;
    height: 0.5rem;
    margin-top: 0.55em;
    border-radius: 50%;
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

  .info .dot {
    background: var(--color-accent);
  }

  .success {
    background: var(--color-success-soft);
  }

  .success .dot {
    background: var(--color-success);
  }

  .attention {
    background: var(--color-attention-soft);
  }

  .attention .dot {
    background: var(--color-attention);
  }
</style>
