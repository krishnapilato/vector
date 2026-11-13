<script lang="ts">
  import { copy } from '../lib/copy'

  interface Props {
    value?: number
    name: string
    legend?: string
    lowLabel?: string
    highLabel?: string
    disabled?: boolean
  }

  let {
    value = $bindable(3),
    name,
    legend = copy.clarity.legend,
    lowLabel = copy.clarity.low,
    highLabel = copy.clarity.high,
    disabled = false,
  }: Props = $props()

  const steps = [1, 2, 3, 4, 5] as const
</script>

<fieldset class="scale" {disabled}>
  <legend>{legend}</legend>
  <div class="options">
    {#each steps as step (step)}
      <label class="option">
        <input type="radio" {name} value={step} bind:group={value} />
        <span class="number">{step}</span>
        {#if step === 1}<span class="visually-hidden">{lowLabel}</span>{/if}
        {#if step === 5}<span class="visually-hidden">{highLabel}</span>{/if}
      </label>
    {/each}
  </div>
  <div class="ends" aria-hidden="true">
    <span>{lowLabel}</span>
    <span>{highLabel}</span>
  </div>
</fieldset>

<style>
  .scale {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-3);
    font-weight: var(--font-weight-medium);
  }

  .options {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .option {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 3.5rem;
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease);
  }

  .option:hover {
    background: var(--color-accent-soft);
  }

  .option input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .option:has(input:focus-visible) {
    outline: var(--border-thick) solid var(--color-accent);
    outline-offset: 2px;
  }

  .option:has(input:checked) {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .number {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    font-weight: var(--font-weight-medium);
  }

  .ends {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .scale:disabled .option {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
