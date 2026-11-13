<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  interface Props {
    label: string
    value?: string | number | null
    type?: 'text' | 'number'
    hint?: string
    /** A calm note shown when the value cannot be used, e.g. a page past the end of the chapter. */
    invalid?: string
    suffix?: string
    placeholder?: string
    inputmode?: HTMLInputAttributes['inputmode']
    disabled?: boolean
    min?: number
    max?: number
    oninput?: (value: string | number | null) => void
  }

  let {
    label,
    value = $bindable(''),
    type = 'text',
    hint,
    invalid,
    suffix,
    placeholder,
    inputmode,
    disabled = false,
    min,
    max,
    oninput,
  }: Props = $props()

  const uid = $props.id()
  const describedby = $derived(
    [invalid ? `${uid}-invalid` : null, hint ? `${uid}-hint` : null].filter(Boolean).join(' ') ||
      undefined,
  )
</script>

<div class="field" class:has-invalid={invalid}>
  <label for={uid}>{label}</label>
  <div class="control">
    <input
      id={uid}
      {type}
      bind:value
      {placeholder}
      {inputmode}
      {disabled}
      {min}
      {max}
      oninput={(event) => oninput?.(type === 'number' ? (event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber) : event.currentTarget.value)}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedby}
    />
    {#if suffix}<span class="suffix" aria-hidden="true">{suffix}</span>{/if}
  </div>
  {#if invalid}<p id="{uid}-invalid" class="invalid">{invalid}</p>{/if}
  {#if hint}<p id="{uid}-hint" class="hint">{hint}</p>{/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  label {
    font-weight: var(--font-weight-medium);
  }

  .control {
    display: flex;
    align-items: center;
    min-height: var(--target-min);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    transition:
      background-color var(--duration-fast) var(--ease),
      box-shadow var(--duration-fast) var(--ease);
  }

  /* No border: the label above names the field; focus draws a clear accent ring. */
  .control:focus-within {
    background: var(--color-surface-raised);
    box-shadow:
      0 0 0 var(--border-thick) var(--color-accent),
      0 0 0 6px var(--color-focus-ring);
  }

  /* width: 0 + flex: 1 lets the field shrink to any column, down to 360 px screens. */
  input {
    flex: 1;
    width: 0;
    min-width: 0;
    min-height: var(--target-min);
    padding: 0 var(--space-3);
    border: 0;
    background: none;
    font-variant-numeric: tabular-nums;
  }

  input:focus-visible {
    outline: none;
  }

  .suffix {
    padding-right: var(--space-3);
    color: var(--color-text-secondary);
  }

  .hint,
  .invalid {
    font-size: var(--text-sm);
  }

  .hint {
    color: var(--color-text-secondary);
  }

  .invalid {
    color: var(--color-attention);
  }

  .has-invalid .control {
    background: var(--color-attention-soft);
  }

  input:disabled {
    cursor: not-allowed;
  }

  .control:has(input:disabled) {
    background: var(--color-bg);
    color: var(--color-text-secondary);
  }
</style>
