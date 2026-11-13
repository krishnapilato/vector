<script lang="ts" generics="T extends string">
  interface Option {
    value: T
    label: string
  }

  interface Props {
    options: readonly Option[]
    value: T
    name: string
    legend: string
    hideLegend?: boolean
    onchange?: (value: T) => void
  }

  let { options, value = $bindable(), name, legend, hideLegend = false, onchange }: Props = $props()
</script>

<fieldset class="segmented">
  <legend class:visually-hidden={hideLegend}>{legend}</legend>
  <div class="options">
    {#each options as option (option.value)}
      <label class="option">
        <input
          type="radio"
          {name}
          value={option.value}
          bind:group={value}
          onchange={() => onchange?.(option.value)}
        />
        <span>{option.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .segmented {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
    font-weight: var(--font-weight-medium);
  }

  .options {
    display: flex;
    gap: 2px;
    padding: 3px;
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }

  .option {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: var(--target-min);
    padding: 0 var(--space-3);
    border-radius: calc(var(--radius-md) - 3px);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    text-align: center;
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease);
  }

  .option input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .option:hover {
    color: var(--color-text);
  }

  .option:has(input:checked) {
    background: var(--color-surface-raised);
    color: var(--color-accent);
    box-shadow: var(--shadow-sm);
  }

  .option:has(input:focus-visible) {
    outline: var(--border-thick) solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
