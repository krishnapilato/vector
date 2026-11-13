<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    as?: 'section' | 'article' | 'div'
    elevation?: 'flat' | 'raised'
    labelledby?: string
    children: Snippet
  }

  let { as = 'div', elevation = 'flat', labelledby, children }: Props = $props()
</script>

<svelte:element this={as} class="card {elevation}" aria-labelledby={labelledby}>
  {@render children()}
</svelte:element>

<style>
  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    border: var(--border-thin) solid var(--color-border);
  }

  .flat {
    background: var(--color-surface);
  }

  .raised {
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-md);
  }
</style>
