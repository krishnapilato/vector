<!--
  The Focus screen (PIANO-V3-LITE §4.1): one page, three moments.
    ready     → pick what you work on, how long, camera on or off, press Start
    session   → a calm timer; the camera (if on) watches for distraction and tiredness
    wrap-up   → a summary, a 1–5 rating, an optional note, save
  Heavy parts (the database, the camera, the focus logic) load only when needed, so the page
  itself stays small and opens instantly.
-->
<script lang="ts">
  import { tick } from 'svelte'
  import Button from '../../components/Button.svelte'
  import InlineAlert from '../../components/InlineAlert.svelte'
  import RatingSelector from '../../components/RatingSelector.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import StatusBadge from '../../components/StatusBadge.svelte'
  import Switch from '../../components/Switch.svelte'
  import TextField from '../../components/TextField.svelte'
  import Timer from '../../components/Timer.svelte'
  import type { FocusTracker, FrameSample, Signal } from '../../core/focus/focus'
  import { defaultSettings, durations } from '../../core/model/defaults'
  import type { ActiveSession, ClarityRating, Settings } from '../../core/model/schemas'
  import {
    activeMs,
    activeSeconds,
    applyAbsence,
    isFinished,
    isRunning,
    pauseTimer,
    progress,
    remainingMs,
    resumeTimer,
    startTimer,
  } from '../../core/session/timer'
  import { clearActive, loadActive, storeActive } from '../../lib/active'
  import type { CameraFailure, CameraHandle } from '../../lib/camera'
  import { copy } from '../../lib/copy'

  type Moment = 'ready' | 'calibrating' | 'session' | 'wrap-up'

  /** Leaving the tab for longer than this pauses a camera session (§4.1 B). */
  const awayGraceMs = 60_000
  const calibrationMs = 15_000

  // ── Shared state ───────────────────────────────────────────────────────────
  let moment = $state<Moment>('ready')
  let starting = $state(false)
  let cameraRequest = 0
  let settings = $state<Settings>(defaultSettings())
  let now = $state(Date.now())
  /** Raw, not deep: it is always replaced whole, and IndexedDB cannot store Svelte proxies. */
  let active = $state.raw<ActiveSession | null>(null)

  // ── Ready ──────────────────────────────────────────────────────────────────
  let tag = $state<string | number | null>('')
  // What the user picked wins; until then the defaults from Settings apply (they load async).
  let pickedDuration = $state<string | null>(null)
  const duration = $derived(pickedDuration ?? String(settings.defaultDurationMin))
  const durationOptions = durations.map((d) => ({
    value: String(d),
    label: copy.focus.durationLabel(d),
  }))
  let pickedCamera = $state<boolean | null>(null)
  const cameraOn = $derived(pickedCamera ?? settings.cameraEnabledByDefault)

  // ── Camera and focus (in memory only) ──────────────────────────────────────
  let camera = $state.raw<CameraHandle | null>(null)
  let tracker = $state.raw<FocusTracker | null>(null)
  let cameraProblem = $state<CameraFailure | null>(null)
  let notice = $state<string | null>(null)
  let breakSignals = $state<Signal[] | null>(null)
  let showWhy = $state(false)
  let calibrationVideo = $state<HTMLVideoElement>()
  let calibrationCanvas = $state<HTMLCanvasElement>()
  let calibrationNote = $state<string | null>(null)

  // ── Wrap-up ────────────────────────────────────────────────────────────────
  let rating = $state(3)
  let note = $state<string | number | null>('')
  let saving = $state(false)

  const running = $derived(active ? isRunning(active.timer) : false)
  const cameraTone = $derived(!camera ? 'off' : running ? 'active' : 'paused')

  /** Saves the running session so a reload or a closed browser resumes it exactly. */
  function remember(next: ActiveSession) {
    active = next
    storeActive(next)
  }

  // On load: resume a running session, read settings and recent tags in the background.
  $effect(() => {
    const saved = loadActive()
    if (saved) {
      let resumed = saved
      if (saved.cameraUsed && saved.hiddenAt !== null) {
        const r = applyAbsence(saved.timer, saved.hiddenAt, Date.now(), awayGraceMs)
        resumed = { ...saved, timer: r.timer, hiddenAt: null }
        if (r.paused) notice = copy.pausedLeft
      }
      remember(resumed)
      // An ended (or finished) session goes straight to its wrap-up, never back to the timer.
      const ended = resumed.endedAt !== null || isFinished(resumed.timer, Date.now())
      moment = ended ? 'wrap-up' : 'session'
      if (moment === 'session' && resumed.cameraUsed) void startFocusTracking()
    }
    void (async () => {
      const store = await import('../../lib/store')
      const loaded = await store.getSettings()
      settings = loaded
      // Cache the face model while idle, so the camera also works offline later.
      if (loaded.cameraEnabledByDefault) void import('../../lib/warm').then((m) => m.warmModels())
    })()
    return () => {
      cameraRequest++
      camera?.stop()
    }
  })

  // One tick a second: redraw the timer and notice the end.
  $effect(() => {
    const id = setInterval(() => {
      now = Date.now()
      if (moment === 'session' && active && isFinished(active.timer, now)) void finish(true)
    }, 1000)
    return () => clearInterval(id)
  })

  // Leaving the tab during a camera session: pause after 60 s away (§4.1 B).
  $effect(() => {
    const onVisibility = () => {
      if (moment !== 'session' || !active?.cameraUsed) return
      if (document.visibilityState === 'hidden') remember({ ...active, hiddenAt: Date.now() })
      else if (active.hiddenAt !== null) {
        const r = applyAbsence(active.timer, active.hiddenAt, Date.now(), awayGraceMs)
        if (r.paused) notice = copy.pausedLeft
        remember({ ...active, timer: r.timer, hiddenAt: null })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })

  // ── Ready → session ────────────────────────────────────────────────────────
  async function start() {
    if (starting || moment !== 'ready') return
    starting = true
    try {
      const minutes = Number(duration)
      const withCamera = cameraOn
      remember({
        tag: String(tag ?? '')
          .trim()
          .slice(0, 60),
        cameraUsed: withCamera,
        timer: startTimer(Date.now(), minutes > 0 ? minutes * 60_000 : null),
        hiddenAt: null,
        endedAt: null,
        focusAggregates: null,
      })
      if (!withCamera) {
        moment = 'session'
        return
      }
      const store = await import('../../lib/store')
      if (await store.activeCalibration()) {
        moment = 'session'
        void startFocusTracking()
      } else {
        // No posture profile yet: a 15-second calibration first (§4.1 A), skippable.
        if (active) remember({ ...active, timer: pauseTimer(active.timer, Date.now()) })
        moment = 'calibrating'
        await tick()
        void calibrate()
      }
    } finally {
      starting = false
    }
  }

  async function calibrate() {
    const request = ++cameraRequest
    const [{ startCamera }, focus, store] = await Promise.all([
      import('../../lib/camera'),
      import('../../core/focus/focus'),
      import('../../lib/store'),
    ])
    if (request !== cameraRequest) return
    const samples: FrameSample[] = []
    const view =
      calibrationVideo && calibrationCanvas
        ? { video: calibrationVideo, canvas: calibrationCanvas }
        : undefined
    const handle = await startCamera(
      (s) => samples.push(s),
      (reason) => {
        if (request === cameraRequest) cameraProblem = reason
      },
      view,
    )
    if (request !== cameraRequest) {
      handle?.stop()
      return
    }
    camera = handle
    if (!camera) return beginSession(false)
    await new Promise((resolve) => setTimeout(resolve, calibrationMs))
    if (request !== cameraRequest || moment !== 'calibrating') return
    camera.stop()
    camera = null
    const posture = focus.calibrate(samples)
    samples.length = 0
    if (posture) {
      await store.saveCalibration({
        id: crypto.randomUUID(),
        label: 'Desk',
        ...posture,
        createdAt: Date.now(),
      })
      if (request !== cameraRequest) return
      calibrationNote = copy.focus.calibrationDone
    } else calibrationNote = copy.focus.calibrationFailed
    beginSession(true)
  }

  function skipCalibration() {
    cameraRequest++
    camera?.stop()
    camera = null
    beginSession(true)
  }

  function beginSession(withCamera: boolean) {
    if (!active) return
    remember({ ...active, cameraUsed: withCamera, timer: resumeTimer(active.timer, Date.now()) })
    moment = 'session'
    if (withCamera) void startFocusTracking()
  }

  // ── Session: the camera feeds the focus logic ──────────────────────────────
  async function startFocusTracking() {
    const request = ++cameraRequest
    const [{ startCamera }, focus, store] = await Promise.all([
      import('../../lib/camera'),
      import('../../core/focus/focus'),
      import('../../lib/store'),
    ])
    const calibration = await store.activeCalibration()
    if (request !== cameraRequest) return
    let current = focus.startTracker(calibration ?? focus.neutralPosture, settings.sensitivity)
    if (active?.focusAggregates) current = { ...current, aggregates: { ...active.focusAggregates } }
    tracker = current
    let lastSaved = 0

    const handle = await startCamera(
      (sample) => {
        if (request !== cameraRequest || !active || !isRunning(active.timer) || !tracker) return
        const result = focus.step(tracker, sample)
        tracker = result.tracker
        if (result.shouldPause) {
          notice = copy.pausedAway
          remember({ ...active, timer: pauseTimer(active.timer, Date.now()) })
        }
        if (result.suggestBreak) breakSignals = [...result.tracker.signals]
        // Keep the totals with the running session every 10 s, in case the page closes.
        if (sample.timestamp - lastSaved > 10_000) {
          lastSaved = sample.timestamp
          remember({ ...active, focusAggregates: { ...result.tracker.aggregates } })
        }
      },
      (reason) => {
        if (request === cameraRequest) cameraProblem = reason
      },
    )
    if (request !== cameraRequest) handle?.stop()
    else camera = handle
  }

  function togglePause() {
    if (!active) return
    notice = null
    const t = Date.now()
    remember({
      ...active,
      timer: running ? pauseTimer(active.timer, t) : resumeTimer(active.timer, t),
    })
  }

  async function answerBreak(accepted: boolean) {
    const focus = await import('../../core/focus/focus')
    if (tracker) tracker = focus.answerBreak(tracker, accepted)
    breakSignals = null
    showWhy = false
    if (accepted && active && running)
      remember({ ...active, timer: pauseTimer(active.timer, Date.now()) })
  }

  // ── Session → wrap-up → ready ──────────────────────────────────────────────
  async function finish(timeUp: boolean) {
    if (!active) return
    cameraRequest++
    camera?.stop()
    camera = null
    remember({
      ...active,
      timer: pauseTimer(active.timer, Date.now()),
      endedAt: Date.now(),
      focusAggregates: tracker ? { ...tracker.aggregates } : active.focusAggregates,
    })
    moment = 'wrap-up'
    if (timeUp && settings.soundEnabled) void import('../../lib/sound').then((m) => m.chime())
  }

  async function save() {
    if (!active || saving) return
    saving = true
    try {
      const store = await import('../../lib/store')
      await store.saveSession({
        id: crypto.randomUUID(),
        tag: active.tag,
        startedAt: active.timer.startedAt,
        endedAt: active.endedAt ?? Date.now(),
        activeSeconds: activeSeconds(active.timer, Date.now()),
        pauseCount: active.timer.pauses,
        cameraUsed: active.cameraUsed,
        focusAggregates: active.focusAggregates,
        clarityRating: rating as ClarityRating,
        note: String(note ?? '')
          .trim()
          .slice(0, 200),
      })
      reset()
    } finally {
      // If saving fails the wrap-up stays, so the user can try again.
      saving = false
    }
  }

  function reset() {
    clearActive()
    active = null
    tracker = null
    notice = null
    breakSignals = null
    cameraProblem = null
    calibrationNote = null
    rating = 3
    note = ''
    moment = 'ready'
  }
</script>

{#if moment === 'ready'}
  <div class="ready-layout">
    <div class="introduction">
      <p class="eyebrow"><span></span> A LITTLE SPACE FOR DEEP WORK</p>
      <h1 id="ready-title">{copy.focus.ready}</h1>
      <p class="intro-copy">One thing at a time.<br />Make room for what matters.</p>
      <div class="orbit" aria-hidden="true">
        <div class="orbit-ring outer"></div><div class="orbit-ring middle"></div><div class="orbit-ring inner"></div>
        <span class="orbit-core">v<span>find your focus</span></span><span class="orbit-dot"></span>
      </div>
      <p class="intro-footnote">Less noise. More presence.</p>
    </div>
  <section class="moment panel" aria-labelledby="setup-title">
    <h2 id="setup-title">Set your intention.</h2>
    <p class="panel-description">Choose a task, settle in, and take it from here.</p>
    <TextField label={copy.focus.tagLabel} bind:value={tag} placeholder={copy.focus.tagPlaceholder} />
    <SegmentedControl
      name="duration"
      legend={copy.focus.duration}
      options={durationOptions}
      bind:value={() => duration, (v) => (pickedDuration = v)}
    />
    <div class="camera-row">
      <svg class="camera-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h9A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5zM16 10.5l4-2.5v8l-4-2.5" />
      </svg>
      <div class="camera-switch">
        <Switch label={copy.focus.camera} bind:checked={() => cameraOn, (v) => (pickedCamera = v)} />
      </div>
    </div>
    <p class="camera-caption">An optional, on-device companion. No recordings, ever.</p>
    <Button variant="primary" size="lg" full disabled={starting} onclick={start}>{copy.focus.start}<span aria-hidden="true">↗</span></Button>
    <p class="session-footnote">A fresh start. At your own pace.</p>
  </section>
  </div>
{:else if moment === 'calibrating'}
  <section class="moment" aria-labelledby="calibration-title">
    <h1 id="calibration-title">{copy.focus.calibrating}</h1>
    <div class="frame">
      <!-- Shown only during these 15 seconds; never recorded or saved. -->
      <video bind:this={calibrationVideo} muted playsinline></video>
      <canvas bind:this={calibrationCanvas} aria-hidden="true"></canvas>
    </div>
    {#if cameraProblem}<InlineAlert tone="attention">{copy.camera[cameraProblem]}</InlineAlert>{/if}
    <div><Button variant="quiet" onclick={skipCalibration}>{copy.focus.calibrationSkip}</Button></div>
  </section>
{:else if moment === 'session' && active}
  <section class="moment session" aria-label={copy.focus.title}>
    <div class="status">
      <StatusBadge
        tone={active.cameraUsed ? cameraTone : 'off'}
        label={active.cameraUsed && camera ? copy.camera.active : copy.camera.off}
      />
      {#if tracker && camera}<span class="state" role="status">{copy.state[tracker.state]}</span>{/if}
    </div>
    {#if active.tag}
      <h1 class="tag-title">{active.tag}</h1>
    {:else}
      <h1 class="visually-hidden">{copy.focus.running}</h1>
    {/if}

    <Timer
      remainingMs={remainingMs(active.timer, now)}
      elapsedMs={activeMs(active.timer, now)}
      progress={progress(active.timer, now)}
      paused={!running}
      alwaysShow={settings.alwaysShowTimer}
    />

    {#if calibrationNote}<InlineAlert>{calibrationNote}</InlineAlert>{/if}
    {#if cameraProblem}<InlineAlert tone="attention">{copy.camera[cameraProblem]}</InlineAlert>{/if}
    {#if notice}<InlineAlert tone="attention" live>{notice}</InlineAlert>{/if}

    {#if breakSignals && tracker}
      <InlineAlert live title={copy.breakOffer}>
        {#if showWhy}
          {#await import('../../core/focus/focus') then focus}
            <p>{copy.explain(breakSignals, focus.evidence(tracker))}</p>
          {/await}
        {/if}
        {#snippet action()}
          <div class="actions">
            <Button variant="quiet" onclick={() => (showWhy = !showWhy)}>{copy.why}</Button>
            <Button onclick={() => answerBreak(false)}>{copy.breakNo}</Button>
            <Button variant="primary" onclick={() => answerBreak(true)}>{copy.breakYes}</Button>
          </div>
        {/snippet}
      </InlineAlert>
    {/if}

    <div class="controls">
      <Button size="lg" onclick={togglePause}>{running ? copy.focus.pause : copy.focus.resume}</Button>
      <Button size="lg" variant="quiet" onclick={() => finish(false)}>{copy.focus.end}</Button>
    </div>
  </section>
{:else if moment === 'wrap-up' && active}
  <section class="moment" aria-labelledby="wrap-title">
    <h1 id="wrap-title" class="summary">
      {copy.wrapUp.summary(activeSeconds(active.timer, now), active.focusAggregates?.focusScorePct ?? null)}
    </h1>
    {#if active.tag}<p class="muted">{active.tag}</p>{/if}
    <form class="moment" onsubmit={(e) => { e.preventDefault(); void save() }}>
      <RatingSelector name="rating" bind:value={rating} />
      <TextField label={copy.wrapUp.note} bind:value={note} placeholder={copy.wrapUp.notePlaceholder} />
      <div class="wrap-actions">
        <Button size="lg" onclick={reset}>{copy.wrapUp.discard}</Button>
        <Button variant="primary" size="lg" type="submit" disabled={saving}>{copy.wrapUp.save}</Button>
      </div>
    </form>
  </section>
{/if}

<style>
  .moment {
    min-width: 0;
    display: grid;
    gap: var(--space-5);
  }

  /* The ready card: one raised surface that collects the inputs, centred in the window. */
  .panel {
    width: 100%;
    margin: 0 auto;
    padding: clamp(1.5rem, 3vw, 2.5rem);
    border: var(--border-thin) solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-md);
  }

  .ready-layout { display: grid; gap: var(--space-7); align-items: center; padding-block: clamp(0rem, 3vh, 3rem); }
  .introduction { position: relative; min-width: 0; }
  .eyebrow { display: flex; align-items: center; gap: var(--space-2); font-size: 0.6875rem; letter-spacing: 0.12em; font-weight: 600; color: var(--color-accent); }
  .eyebrow > span { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .introduction h1 { max-width: 9ch; margin-top: var(--space-5); font-size: clamp(2.75rem, 4.5vw, 4.5rem); line-height: 1.05; letter-spacing: -0.055em; }
  .intro-copy { margin-top: var(--space-5); color: var(--color-text-secondary); font-size: var(--text-lg); }
  .intro-footnote { color: var(--color-text-secondary); font-size: var(--text-xs); }
  .orbit { position: relative; width: min(17rem, 100%); aspect-ratio: 1; margin-block: var(--space-5); display: grid; place-items: center; }
  .orbit-ring { position: absolute; border: 1px solid var(--color-border); border-radius: 50%; }
  .outer { inset: 0; border-style: dashed; }
  .middle { inset: 15%; }
  .inner { inset: 30%; background: var(--color-accent-soft); border-color: transparent; }
  .orbit-core { z-index: 1; color: var(--color-accent); font-size: 3rem; font-weight: 500; text-align: center; line-height: 1; }
  .orbit-core > span { display: block; margin-top: var(--space-3); font-size: 0.625rem; letter-spacing: 0.08em; }
  .orbit-dot { position: absolute; top: 19%; right: 22%; width: 10px; height: 10px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 0 5px var(--color-bg); }
  .panel h2 { font-size: 1.75rem; letter-spacing: -0.04em; }
  .panel-description { margin-top: calc(-1 * var(--space-3)); color: var(--color-text-secondary); font-size: var(--text-sm); }
  .camera-caption { margin-top: calc(-1 * var(--space-4)); color: var(--color-text-secondary); font-size: var(--text-xs); }
  .session-footnote { text-align: center; color: var(--color-text-secondary); font-size: var(--text-xs); }
  .session, .moment:has(> .summary), .moment:has(> .frame) { width: min(100%, 34rem); margin: var(--space-6) auto; padding: var(--space-6); background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  @media (width >= 75rem) { .ready-layout { grid-template-columns: minmax(0, 1fr) minmax(24rem, 1fr); gap: clamp(2rem, 5vw, 6rem); } }
  @media (width < 75rem) { .introduction h1 { max-width: none; } .orbit, .intro-footnote { display: none; } .panel { max-width: 36rem; } .intro-copy { font-size: var(--text-md); } }


  /* The camera gets its own line: icon, label, switch, under a light divider. */
  .camera-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: var(--border-thin) solid var(--color-border);
  }

  .camera-icon {
    flex: none;
    width: 1.375rem;
    height: 1.375rem;
    fill: none;
    stroke: var(--color-text-secondary);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .camera-switch {
    flex: 1;
  }

  @media (width < 30rem) {
    .panel {
      padding: var(--space-5);
    }
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .status {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--space-2) var(--space-5);
    min-height: var(--target-min);
  }

  .state {
    font-weight: var(--font-weight-medium);
  }

  .tag-title {
    font-size: var(--text-lg);
    text-align: center;
    overflow-wrap: anywhere;
  }

  .summary {
    font-size: var(--text-xl);
  }

  .frame {
    position: relative;
    width: min(100%, 26rem);
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-text);
  }

  /* Mirrored, like a mirror: easier to place yourself. */
  .frame video,
  .frame canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: scaleX(-1);
  }

  .frame video {
    object-fit: cover;
  }

  /* Discard and Save side by side, both easy to reach. */
  .wrap-actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-3);
  }

  .actions,
  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }
</style>
