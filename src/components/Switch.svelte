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
    width: 3.25rem;
    height: 2rem;
    border-radius: var(--radius-pill);
    background: var(--color-fill-strong);
    transition: background-color var(--duration-base) var(--ease);
  }

  /* A white knob with a soft shadow, sliding to the right when on. */
  .thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 1.625rem;
    height: 1.625rem;
    border-radius: 50%;
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-md);
    transition: transform var(--duration-base) var(--ease);
  }

  [aria-checked='true'] .track {
    background: var(--color-accent);
  }

  [aria-checked='true'] .thumb {
    transform: translateX(1.25rem);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
