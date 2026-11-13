<script lang="ts">
  interface Props {
    checked?: boolean
    label: string
    description?: string
    disabled?: boolean
    onchange?: (checked: boolean) => void
  }

  let {
    checked = $bindable(false),
    label,
    description,
    disabled = false,
    onchange,
  }: Props = $props()

  const uid = $props.id()
</script>

<div class="row">
  <div class="text">
    <label id="{uid}-label" for={uid}>{label}</label>
    {#if description}<p id="{uid}-description" class="description">{description}</p>{/if}
  </div>
  <button
    id={uid}
    type="button"
    role="switch"
    aria-labelledby="{uid}-label"
    aria-checked={checked}
    aria-describedby={description ? `${uid}-description` : undefined}
    {disabled}
    onclick={() => {
      checked = !checked
      onchange?.(checked)
    }}
  >
    <span class="track"><span class="thumb"></span></span>
  </button>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .text {
    display: grid;
    gap: var(--space-1);
  }

  label {
    font-weight: var(--font-weight-medium);
    cursor: pointer;
  }

  .description {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  button {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 3.5rem;
    min-height: var(--target-min);
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    cursor: pointer;
  }

  .track {
    position: relative;
    width: 3rem;
    height: 1.75rem;
    border: var(--border-medium) solid var(--color-border-strong);
    border-radius: 999px;
    background: var(--color-surface-raised);
    transition:
      background-color var(--duration-fast) var(--ease),
      border-color var(--duration-fast) var(--ease);
  }

  .thumb {
    position: absolute;
    top: 50%;
    left: 3px;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: var(--color-border-strong);
    transform: translateY(-50%);
    transition:
      transform var(--duration-fast) var(--ease),
      background-color var(--duration-fast) var(--ease);
  }

  [aria-checked='true'] .track {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  [aria-checked='true'] .thumb {
    background: var(--color-on-accent);
    transform: translate(1.25rem, -50%);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
