<script lang="ts">
  interface Props {
    value: number
    max: number
    label: string
    valueText: string
    /** Draws one segment per unit: good for small counts like weekly blocks. */
    segmented?: boolean
  }

  let { value, max, label, valueText, segmented = false }: Props = $props()

  const clamped = $derived(Math.min(max, Math.max(0, value)))
  const percent = $derived(max > 0 ? (clamped / max) * 100 : 0)
  const segments = $derived(Array.from({ length: Math.max(0, Math.round(max)) }, (_, i) => i))
</script>

<div class="progress">
  <div class="head">
    <span class="label">{label}</span>
    <span class="value">{valueText}</span>
  </div>
  <div
    class="track"
    class:segmented
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={clamped}
    aria-valuetext={valueText}
  >
    {#if segmented}
      {#each segments as i (i)}
        <span class="segment" class:filled={i < clamped}></span>
      {/each}
    {:else}
      <span class="fill" style:width="{percent}%"></span>
    {/if}
  </div>
</div>

<style>
  .progress {
    display: grid;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .label {
    color: var(--color-text-secondary);
  }

  .value {
    font-family: var(--font-mono);
    font-weight: var(--font-weight-medium);
  }

  .track {
    position: relative;
    height: 0.625rem;
    border-radius: var(--radius-sm);
    background: var(--color-accent-soft);
    overflow: hidden;
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--color-accent);
    transition: width var(--duration-base) var(--ease);
  }

  .track.segmented {
    display: flex;
    gap: 3px;
    background: none;
  }

  .segment {
    flex: 1;
    border-radius: 2px;
    background: var(--color-accent-soft);
    transition: background-color var(--duration-base) var(--ease);
  }

  .segment.filled {
    background: var(--color-accent);
  }
</style>
