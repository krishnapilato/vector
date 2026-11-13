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
  }

  label {
    font-weight: var(--font-weight-medium);
  }

  .control {
    display: flex;
    align-items: center;
    min-height: var(--target-min);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    transition: border-color var(--duration-fast) var(--ease);
  }

  .control:focus-within {
    border-color: var(--color-accent);
    outline: var(--border-thin) solid var(--color-accent);
  }

  input {
    flex: 1;
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

  input[type='number'] {
    font-family: var(--font-mono);
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
    border-color: var(--color-attention);
  }

  input:disabled {
    cursor: not-allowed;
  }

  .control:has(input:disabled) {
    border-color: var(--color-border);
    background: var(--color-bg);
    color: var(--color-text-secondary);
  }
</style>
