<!--
  A row of mutually exclusive choices (native radio buttons, so keyboard and screen readers work
  as expected). A single pill glides under the chosen option: CSS only, using the motion tokens,
  and still when the system asks for reduced motion.
-->
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

  const selected = $derived(
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  )
</script>

<fieldset class="segmented">
  <legend class:visually-hidden={hideLegend}>{legend}</legend>
  <div class="options" style:--count={options.length} style:--selected={selected}>
    <span class="pill" aria-hidden="true"></span>
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
    --inset: 3px;
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    padding: var(--inset);
    border-radius: var(--radius-sm);
    background: var(--color-fill);
  }

  /* One pill, one column wide, moved to the chosen column. */
  .pill {
    position: absolute;
    top: var(--inset);
    bottom: var(--inset);
    left: var(--inset);
    width: calc((100% - 2 * var(--inset)) / var(--count));
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-sm);
    transform: translateX(calc(var(--selected) * 100%));
    transition: transform var(--duration-base) var(--ease);
  }

  .option {
    position: relative;
    display: grid;
    place-items: center;
    min-height: var(--target-min);
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    text-align: center;
    cursor: pointer;
    transition: color var(--duration-fast) var(--ease);
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
    color: var(--color-accent);
  }

  .option:has(input:focus-visible) {
    outline: var(--border-thick) solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
