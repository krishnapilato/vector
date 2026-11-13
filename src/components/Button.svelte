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
  <a class="button {variant} {size}" class:full href={disabled ? undefined : href} aria-disabled={disabled || undefined} tabindex={disabled ? -1 : undefined} onclick={disabled ? (event) => event.preventDefault() : onclick}>{@render children()}</a>
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
    border: 0;
    border-radius: var(--radius-sm);
    font-size: var(--text-md);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease),
      transform var(--duration-fast) var(--ease);
  }

  .button:active:not(:disabled):not([aria-disabled="true"]) {
    transform: scale(0.98);
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

  .primary {
    box-shadow: var(--shadow-sm);
  }

  .primary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-accent-strong);
    color: var(--color-on-accent);
  }

  .secondary {
    background: var(--color-fill);
    color: var(--color-text);
  }

  .secondary:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-fill-strong);
    color: var(--color-text);
  }

  .quiet {
    padding: 0 var(--space-3);
    background: transparent;
    color: var(--color-accent);
  }

  .quiet:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
  }

  .button:disabled,
  .button[aria-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
