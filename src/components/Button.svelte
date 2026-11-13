<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    variant?: 'primary' | 'secondary' | 'quiet'
    size?: 'md' | 'lg'
    href?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    full?: boolean
    onclick?: (event: MouseEvent) => void
    children: Snippet
  }

  let {
    variant = 'secondary',
    size = 'md',
    href,
    type = 'button',
    disabled = false,
    full = false,
    onclick,
    children,
  }: Props = $props()
</script>

{#if href}
  <a class="button {variant} {size}" class:full {href}>{@render children()}</a>
{:else}
  <button class="button {variant} {size}" class:full {type} {disabled} {onclick}>
    {@render children()}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--target-min);
    padding: 0 var(--space-5);
    border: var(--border-thin) solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--text-md);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease),
      border-color var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease);
  }

  .lg {
    min-height: 3.5rem;
    padding: 0 var(--space-6);
    font-size: var(--text-lg);
  }

  .full {
    width: 100%;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .primary:hover:not(:disabled) {
    background: var(--color-accent-strong);
    color: var(--color-on-accent);
  }

  .secondary {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  .secondary:hover:not(:disabled) {
    background: var(--color-accent-soft);
    color: var(--color-text);
  }

  .quiet {
    padding: 0 var(--space-3);
    background: transparent;
    color: var(--color-accent);
  }

  .quiet:hover:not(:disabled) {
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
