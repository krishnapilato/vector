<script lang="ts">
  import Button from '../../components/Button.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import type { FocusState, FocusTracker } from '../../core/focus/focus'
  import { ease } from '../../core/focus/geometry'
  import type { Calibration, Sensitivity } from '../../core/model/schemas'
  import type { CameraHandle } from '../../lib/camera'
  import { copy } from '../../lib/copy'

  interface Props {
    calibration: Calibration | undefined
    sensitivity: Sensitivity
    extras: boolean
  }

  let { calibration, sensitivity, extras }: Props = $props()

  let open = $state(false)
  let starting = $state(false)
  let problem = $state<string | null>(null)
  let video = $state<HTMLVideoElement>()
  let canvas = $state<HTMLCanvasElement>()
  let handle = $state.raw<CameraHandle | null>(null)
  let reading = $state<{
    face: boolean
    yaw: number
    pitch: number
    blink: number
    jaw: number
    phone: boolean | null
    shoulders: number | null
    hand: boolean | null
    state: FocusState
  } | null>(null)

  async function start() {
    open = true
    starting = true
    problem = null
    await Promise.resolve()
    if (!video || !canvas) return
    const [{ startCamera }, focus] = await Promise.all([
      import('../../lib/camera'),
      import('../../core/focus/focus'),
    ])
    let tracker: FocusTracker = focus.startTracker(
      calibration ?? focus.uncalibrated,
      focus.rulesFor(sensitivity),
    )
    handle = await startCamera(
      (sample) => {
        tracker = focus.step(tracker, sample).tracker
        // Readings glide too, so the numbers are easy to follow.
        const previous = reading
        const soft = (key: 'yaw' | 'pitch' | 'blink' | 'jaw', value: number) =>
          ease(previous ? previous[key] : null, value, 0.3)
        reading = {
          face: sample.facePresent,
          yaw: soft('yaw', sample.yaw - (calibration?.yawMean ?? 0)),
          pitch: soft(
            'pitch',
            sample.pitch - (calibration?.pitchMean ?? focus.uncalibrated.pitchMean),
          ),
          blink: soft('blink', sample.blink),
          jaw: soft('jaw', sample.jawOpen),
          phone: sample.phone,
          shoulders:
            sample.shoulderY === null
              ? null
              : sample.shoulderY - (calibration?.shoulderY ?? sample.shoulderY),
          hand: sample.handOnFace,
          state: tracker.state,
        }
      },
      (reason) => {
        problem = copy.session.camera[reason]
        open = false
      },
      { extras, preview: { video, canvas } },
    )
    starting = false
  }

  function stop() {
    handle?.stop()
    handle = null
    reading = null
    open = false
  }

  $effect(() => () => handle?.stop())

  const deg = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}°`
  const pct = (n: number) => `${Math.round(n * 100)}%`
</script>

<div class="check">
  {#if !open}
    <div><Button onclick={start}>{copy.settings.check.open}</Button></div>
    <p class="muted small">{copy.settings.check.hint}</p>
  {/if}
  {#if problem}<InlineNotice tone="attention" live>{problem}</InlineNotice>{/if}

  <div class="panel" hidden={!open}>
    <div class="frame">
      <!-- Shown only while this panel is open; never recorded, saved or sent. -->
      <video bind:this={video} muted playsinline width="320" height="240"></video>
      <canvas bind:this={canvas} width="320" height="240" aria-hidden="true"></canvas>
    </div>
    {#if starting}<p class="muted small" role="status">{copy.session.camera.starting}</p>{/if}
    {#if reading}
      <dl class="numbers" aria-live="off">
        <div><dt>{copy.settings.check.face}</dt><dd>{reading.face ? copy.wrapUp.yes : copy.settings.check.noFace}</dd></div>
        <div><dt>{copy.settings.check.state}</dt><dd>{copy.session.state[reading.state]}</dd></div>
        <div><dt>{copy.settings.check.yaw}</dt><dd>{deg(reading.yaw)}</dd></div>
        <div><dt>{copy.settings.check.pitch}</dt><dd>{deg(reading.pitch)}</dd></div>
        <div><dt>{copy.settings.check.eyes}</dt><dd>{pct(reading.blink)}</dd></div>
        <div><dt>{copy.settings.check.mouth}</dt><dd>{pct(reading.jaw)}</dd></div>
        {#if reading.phone !== null}
          <div><dt>{copy.settings.check.phone}</dt><dd>{reading.phone ? copy.wrapUp.yes : copy.settings.check.none}</dd></div>
        {/if}
        {#if reading.shoulders !== null}
          <div><dt>{copy.settings.check.shoulders}</dt><dd>{pct(-reading.shoulders)}</dd></div>
        {/if}
        {#if reading.hand !== null}
          <div><dt>{copy.settings.check.hand}</dt><dd>{reading.hand ? copy.wrapUp.yes : copy.settings.check.none}</dd></div>
        {/if}
      </dl>
    {/if}
    <p class="muted small">{copy.settings.check.privacy}</p>
    <div><Button onclick={stop}>{copy.settings.check.close}</Button></div>
  </div>
</div>

<style>
  .check,
  .panel {
    display: grid;
    gap: var(--space-3);
  }

  .panel[hidden] {
    display: none;
  }

  .frame {
    position: relative;
    width: min(100%, 26rem);
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-text);
  }

  /* Mirrored, like a mirror: easier to place yourself. */
  video,
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: scaleX(-1);
  }

  video {
    object-fit: cover;
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }

  dt {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .small {
    font-size: var(--text-sm);
  }
</style>
