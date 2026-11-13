<script lang="ts">
  import { elapsedShare, formatClock } from '../core/session/clock'
  import { copy } from '../lib/copy'

  interface Props {
    remainingMs: number
    totalMs: number
    paused?: boolean
    /** Settings: show the time all the time instead of hiding it (plan §5.3). */
    alwaysShow?: boolean
  }

  let { remainingMs, totalMs, paused = false, alwaysShow = false }: Props = $props()

  const holdMs = 2000
  const revealMs = 5000

  let revealed = $state(false)
  let holding = $state(false)
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const visible = $derived(alwaysShow || revealed)
  const clock = $derived(formatClock(remainingMs))
  const done = $derived(elapsedShare(remainingMs, totalMs))

  function startHold() {
    if (visible) return
    holding = true
    clearTimeout(holdTimer)
    holdTimer = setTimeout(() => {
      holding = false
      revealed = true
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        revealed = false
      }, revealMs)
    }, holdMs)
  }

  function endHold() {
    holding = false
    clearTimeout(holdTimer)
  }

  function isActivationKey(event: KeyboardEvent) {
    return event.key === ' ' || event.key === 'Enter'
  }

  function onkeydown(event: KeyboardEvent) {
    if (!isActivationKey(event)) return
    event.preventDefault()
    if (!event.repeat) startHold()
  }

  function onkeyup(event: KeyboardEvent) {
    if (isActivationKey(event)) endHold()
  }

  $effect(() => () => {
    clearTimeout(holdTimer)
    clearTimeout(hideTimer)
  })
</script>

<div class="timer" class:paused class:holding>
  <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
    <circle class="track" cx="60" cy="60" r="54" />
    <circle
      class="done"
      cx="60"
      cy="60"
      r="54"
      pathLength="100"
      stroke-dasharray="100"
      stroke-dashoffset={100 * (1 - done)}
      transform="rotate(-90 60 60)"
    />
    <circle
      class="hold"
      cx="60"
      cy="60"
      r="47"
      pathLength="100"
      stroke-dasharray="100"
      transform="rotate(-90 60 60)"
    />
  </svg>
  {#if alwaysShow}
    <div class="face">
      <span class="clock">{clock}</span>
      {#if paused}<span class="state">{copy.timer.paused}</span>{/if}
    </div>
  {:else}
    <button
      class="face"
      type="button"
      onpointerdown={startHold}
      onpointerup={endHold}
      onpointerleave={endHold}
      onpointercancel={endHold}
      oncontextmenu={(event) => event.preventDefault()}
      {onkeydown}
      {onkeyup}
    >
      {#if visible}
        <span class="clock">{clock}<span class="visually-hidden"> {copy.timer.left}</span></span>
      {:else}
        <span class="hint">{copy.timer.hiddenHint}<span class="visually-hidden"> {copy.timer.hiddenHold}</span></span>
      {/if}
      {#if paused}<span class="state">{copy.timer.paused}</span>{/if}
    </button>
  {/if}
</div>

<style>
  .timer {
    position: relative;
    display: grid;
    place-items: center;
    width: min(16rem, 72vw);
    aspect-ratio: 1;
  }

  .ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  circle {
    fill: none;
  }

  .track {
    stroke: var(--color-accent-soft);
    stroke-width: 6;
  }

  .done {
    stroke: var(--color-accent);
    stroke-width: 6;
    stroke-linecap: round;
    transition: stroke-dashoffset var(--duration-base) var(--ease);
  }

  .paused .done {
    stroke: var(--color-border-strong);
  }

  .hold {
    stroke: var(--color-accent);
    stroke-width: 2;
    stroke-dashoffset: 100;
    opacity: 0;
  }

  /* While held, a thin inner ring fills over the 2 seconds: it shows the hold is working. */
  .holding .hold {
    opacity: 1;
    stroke-dashoffset: 0;
    transition: stroke-dashoffset calc(var(--duration-base) * 10) linear;
  }

  .face {
    position: relative;
    display: grid;
    place-items: center;
    gap: var(--space-1);
    width: 78%;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--color-text);
    text-align: center;
    user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }

  button.face {
    cursor: pointer;
  }

  .clock {
    font-family: var(--font-mono);
    font-size: var(--text-display);
    font-weight: var(--font-weight-regular);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .hint {
    max-width: 9rem;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .state {
    position: absolute;
    bottom: 22%;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
</style>
