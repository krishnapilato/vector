<script lang="ts">
  import { formatClock } from '../core/session/clock'
  import { copy } from '../lib/copy'

  interface Props {
    /** Time left; null for an Open session, which shows the time elapsed instead. */
    remainingMs: number | null
    elapsedMs: number
    /** Share of the planned time done, 0–1 (0 for Open sessions). */
    progress: number
    paused?: boolean
    /** Settings: keep the time visible instead of hiding it (PIANO-V3-LITE §4.1 B). */
    alwaysShow?: boolean
  }

  let { remainingMs, elapsedMs, progress, paused = false, alwaysShow = false }: Props = $props()

  /** A tap shows the time for 3 seconds, then it hides again: no clock-watching. */
  const revealMs = 3000
  const hourMs = 3_600_000
  let revealed = $state(false)
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const visible = $derived(alwaysShow || revealed)
  const clock = $derived(formatClock(remainingMs ?? elapsedMs))
  const suffix = $derived(remainingMs === null ? copy.timer.elapsed : copy.timer.left)
  /** How much of the ring is filled: the planned time, or for Open sessions the current hour. */
  const filled = $derived(remainingMs === null ? (elapsedMs % hourMs) / hourMs : progress)

  function reveal() {
    revealed = true
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      revealed = false
    }, revealMs)
  }

  $effect(() => () => clearTimeout(hideTimer))
</script>

<!-- The ring fills as time passes; the numbers stay hidden until asked for. -->
<button class="timer" class:paused type="button" onclick={reveal} disabled={alwaysShow}>
  <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" r="46" />
    <circle
      class="arc"
      cx="50"
      cy="50"
      r="46"
      pathLength="100"
      stroke-dasharray="{filled * 100} 100"
    />
  </svg>
  <span class="face">
    {#if visible}
      <span class="clock">{clock}</span>
      <span class="label">{suffix}</span>
    {:else}
      <span class="hint">{copy.timer.tapToSee}</span>
    {/if}
    {#if paused}<span class="state">{copy.timer.paused}</span>{/if}
  </span>
</button>

<style>
  .timer {
    position: relative;
    display: grid;
    place-items: center;
    width: min(19rem, 76vw);
    aspect-ratio: 1;
    margin: 0 auto;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
    touch-action: manipulation;
    container-type: inline-size;
  }

  .timer:disabled {
    cursor: default;
  }

  .ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    transform: rotate(-90deg);
  }

  .track {
    stroke: var(--color-fill-strong);
    stroke-width: 1.5;
  }

  .arc {
    stroke: var(--color-accent);
    stroke-width: 3;
    stroke-linecap: round;
    transition:
      stroke-dasharray var(--duration-base) var(--ease),
      stroke var(--duration-base) var(--ease);
  }

  .paused .arc {
    stroke: var(--color-border-strong);
  }

  .face {
    position: relative;
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    padding: var(--space-6);
    text-align: center;
  }

  .clock {
    font-size: clamp(2rem, 19cqi, var(--text-display));
    font-weight: var(--font-weight-regular);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .label,
  .hint,
  .state {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .state {
    font-weight: var(--font-weight-medium);
  }
</style>
