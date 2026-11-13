<script lang="ts">
  interface Props {
    /** active: green dot; paused: amber; off: an empty ring. */
    tone: 'active' | 'paused' | 'off'
    label: string
  }

  let { tone, label }: Props = $props()
</script>

<p class="badge {tone}" role="status">
  <span class="dot" aria-hidden="true"></span>
  {label}
</p>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--color-fill);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: var(--color-border-strong);
  }

  .active .dot {
    background: var(--color-success);
    box-shadow: 0 0 0 3px var(--color-success-soft);
  }

  .paused .dot {
    background: var(--color-attention);
  }
</style>
