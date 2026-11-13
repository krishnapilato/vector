<script lang="ts">
  import Button from '../../components/Button.svelte'
  import CameraIndicator from '../../components/CameraIndicator.svelte'
  import ConfirmDialog from '../../components/ConfirmDialog.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import TextField from '../../components/TextField.svelte'
  import Timer from '../../components/Timer.svelte'
  import type { FocusReason, FocusState, FocusTracker, FrameSample } from '../../core/focus/focus'
  import type {
    ActiveSession,
    Calibration,
    Chapter,
    Exercise,
    Settings,
    SimLesson,
  } from '../../core/model/schemas'
  import {
    activeMinutes,
    applyAbsence,
    isFinished,
    isRunning,
    pauseTimer,
    remainingMs,
    resumeTimer,
  } from '../../core/session/timer'
  import type { CameraFailure, CameraHandle } from '../../lib/camera'
  import { copy } from '../../lib/copy'
  import { db } from '../../lib/db'
  import { describeBlock } from '../../lib/describe'
  import { go, href } from '../../lib/nav'
  import { discardActive, getActive, getSettings, saveActive } from '../../lib/repo'
  import { chime } from '../../lib/sound'

  const graceMs = 60_000
  const calibrationSeconds = 20

  let active = $state<ActiveSession | null>(null)
  let settings = $state<Settings | null>(null)
  let catalogue = $state<{ chapters: Chapter[]; exercises: Exercise[]; simLessons: SimLesson[] }>({
    chapters: [],
    exercises: [],
    simLessons: [],
  })
  let loaded = $state(false)
  let now = $state(Date.now())
  let notice = $state<string | null>(null)
  let confirmEnd = $state(false)

  // Camera and focus: frames stay inside lib/camera; only FrameSample numbers arrive here.
  let camera = $state.raw<CameraHandle | null>(null)
  let cameraState = $state<'active' | 'paused' | 'off' | 'starting'>('off')
  let cameraProblem = $state<CameraFailure | null>(null)
  let calibrating = $state(false)
  let focusState = $state<FocusState>('focused')
  let tracker: FocusTracker | null = null
  let breakOffer = $state<FocusReason[] | null>(null)
  let showWhy = $state(false)
  let pausedByAway = false
  let faceBackSince: number | null = null

  const isDesk = $derived(active?.block.mode === 'desk')
  const isSim = $derived(active?.block.mode === 'simulator')
  const running = $derived(active ? isRunning(active.timer) : false)
  const described = $derived(active ? describeBlock(active.block, catalogue) : null)

  async function persist(next: ActiveSession) {
    active = next
    await saveActive($state.snapshot(next) as ActiveSession)
  }

  async function finish() {
    stopCamera()
    if (active) await persist({ ...active, focus: tracker?.aggregate ?? active.focus })
    go('session/end')
  }

  function stopCamera() {
    camera?.stop()
    camera = null
  }

  async function startFocus(s: Settings) {
    cameraState = 'starting'
    const [{ startCamera }, focus] = await Promise.all([
      import('../../lib/camera'),
      import('../../core/focus/focus'),
    ])
    const saved = await db.calibrations.get(s.station)
    let calibration: Calibration | null = saved ?? null
    const samples: FrameSample[] = []
    calibrating = calibration === null
    tracker = calibration ? focus.startTracker(calibration, focus.rulesFor(s.sensitivity)) : null
    if (active?.focus && tracker) tracker = { ...tracker, aggregate: { ...active.focus } }
    let lastSave = 0

    camera = await startCamera(
      (sample) => {
        if (!active || !isRunning(active.timer)) return
        if (calibrating) {
          samples.push(sample)
          if (sample.t >= calibrationSeconds) {
            calibration = focus.calibrate(s.station, samples, Date.now())
            samples.length = 0
            calibrating = false
            if (calibration) void db.calibrations.put(calibration)
            tracker = focus.startTracker(
              calibration ?? focus.uncalibrated,
              focus.rulesFor(s.sensitivity),
            )
          }
          return
        }
        if (!tracker) return
        const r = focus.step(tracker, sample)
        tracker = r.tracker
        focusState = r.tracker.state
        if (r.shouldPause && active && isRunning(active.timer)) {
          pausedByAway = true
          notice = copy.session.pausedAway
          void persist({ ...active, timer: pauseTimer(active.timer, Date.now()) })
        }
        if (r.suggestBreak) breakOffer = [...r.tracker.reasons]
        if (sample.t - lastSave > 10) {
          lastSave = sample.t
          void persist({ ...active, focus: { ...r.tracker.aggregate } })
        }
      },
      (reason) => {
        cameraProblem = reason
        cameraState = 'off'
      },
    )
    if (camera) cameraState = 'active'
  }

  // While paused because the camera lost sight of you, resume when you're back for a moment.
  $effect(() => {
    if (!active || running || !pausedByAway || !camera) return
    const id = setInterval(() => {
      if (!tracker || !active) return
      const present = tracker.noFaceSince === null
      if (!present) {
        faceBackSince = null
        return
      }
      faceBackSince ??= Date.now()
      if (Date.now() - faceBackSince > 3000) {
        pausedByAway = false
        faceBackSince = null
        notice = null
        void persist({ ...active, timer: resumeTimer(active.timer, Date.now()) })
      }
    }, 1000)
    return () => clearInterval(id)
  })

  $effect(() => {
    void (async () => {
      const [a, s, chapters, exercises, simLessons] = await Promise.all([
        getActive(),
        getSettings(),
        db.chapters.toArray(),
        db.exercises.toArray(),
        db.simLessons.toArray(),
      ])
      catalogue = { chapters, exercises, simLessons }
      settings = s
      if (a && a.hiddenAt !== null && a.block.mode === 'desk' && s.pauseWhenAway) {
        const r = applyAbsence(a.timer, a.hiddenAt, Date.now(), graceMs)
        active = { ...a, timer: r.timer, hiddenAt: null, leftApp: a.leftApp + (r.paused ? 1 : 0) }
        if (r.paused) notice = copy.session.pausedLeft
        await saveActive($state.snapshot(active) as ActiveSession)
      } else {
        active = a ?? null
      }
      loaded = true
      if (active && active.block.mode === 'desk' && s.camera) void startFocus(s)
    })()
    return () => stopCamera()
  })

  // The clock: one tick a second, only to redraw and notice the end.
  $effect(() => {
    const id = setInterval(() => {
      now = Date.now()
      if (active && !isSim && isFinished(active.timer, now)) {
        clearInterval(id)
        if (settings?.sounds) chime()
        void finish()
      }
    }, 1000)
    return () => clearInterval(id)
  })

  // Leaving the app during a desk session: pause after 60 s away (§5.3).
  $effect(() => {
    const onHide = () => {
      if (!active || !isDesk || !settings?.pauseWhenAway) return
      if (document.visibilityState === 'hidden') {
        cameraState = camera ? 'paused' : cameraState
        void persist({ ...active, hiddenAt: Date.now() })
      } else if (active.hiddenAt !== null) {
        cameraState = camera ? 'active' : cameraState
        const r = applyAbsence(active.timer, active.hiddenAt, Date.now(), graceMs)
        if (r.paused) notice = copy.session.pausedLeft
        void persist({
          ...active,
          timer: r.timer,
          hiddenAt: null,
          leftApp: active.leftApp + (r.paused ? 1 : 0),
        })
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  })

  function togglePause() {
    if (!active) return
    const t = Date.now()
    pausedByAway = false
    notice = null
    void persist({
      ...active,
      timer: running ? pauseTimer(active.timer, t) : resumeTimer(active.timer, t),
    })
  }

  async function answerBreak(accepted: boolean) {
    const focus = await import('../../core/focus/focus')
    if (tracker) tracker = focus.answerBreak(tracker, accepted)
    breakOffer = null
    showWhy = false
    if (accepted && active && running)
      void persist({ ...active, timer: pauseTimer(active.timer, Date.now()) })
  }

  function end() {
    if (!active) return
    if (isSim || isFinished(active.timer, Date.now())) void finish()
    else confirmEnd = true
  }

  async function dontLog() {
    stopCamera()
    await discardActive()
    go('')
  }

  function setPage(value: string | number | null) {
    if (!active) return
    const page = value === null || value === '' ? null : Number(value)
    void persist({ ...active, pageReached: Number.isFinite(page) ? page : null })
  }
</script>

{#if !loaded}
  <p class="muted" role="status">{copy.app.loading}</p>
{:else if !active || !described}
  <p>{copy.session.noActive}</p>
  <div><Button href={href('')}>{copy.session.goToday}</Button></div>
{:else}
  <header class="head">
    <p class="meta">{copy.kind[active.block.kind]} · {copy.mode[active.block.mode]}</p>
    <h1 class="title">{described.title}</h1>
    {#if described.detail}<p class="detail">{described.detail}</p>{/if}
  </header>

  {#if isDesk}
    <div class="status">
      <CameraIndicator state={cameraState === 'starting' ? 'off' : cameraState} />
      {#if cameraState === 'starting'}<span class="muted">{copy.session.camera.starting}</span>{/if}
      {#if camera && !calibrating}<span class="state" role="status">{copy.session.state[focusState]}</span>{/if}
      {#if calibrating}<span class="state" role="status">{copy.settings.calibrating}</span>{/if}
    </div>
    {#if cameraProblem}<InlineNotice tone="attention">{copy.session.camera[cameraProblem]}</InlineNotice>{/if}
  {:else if active.block.mode === 'on-the-go'}
    <p class="muted">{copy.session.onTheGo}</p>
  {/if}

  {#if isSim && described.lesson}
    <section class="lesson">
      <p>{copy.session.simIntro}</p>
      <h2>{copy.block.lessonObjectives}</h2>
      <ul>{#each described.lesson.objectives as o}<li>{o}</li>{/each}</ul>
      <h2>{copy.block.lessonTolerances}</h2>
      <ul>{#each described.lesson.tolerances as t}<li>{t}</li>{/each}</ul>
    </section>
    <Button variant="primary" size="lg" full onclick={() => void finish()}>{copy.session.simLog}</Button>
  {:else}
    <div class="timer">
      <Timer
        remainingMs={remainingMs(active.timer, now)}
        totalMs={active.timer.totalMs}
        paused={!running}
        alwaysShow={settings?.alwaysShowTimer ?? false}
      />
    </div>

    {#if notice}<InlineNotice tone="attention" live>{notice}</InlineNotice>{/if}

    {#if breakOffer}
      <InlineNotice tone="info" live title={copy.session.breakOffer}>
        {#if showWhy}
          <ul class="reasons">{#each breakOffer as r}<li>{copy.session.reasons[r]}</li>{/each}</ul>
        {/if}
        {#snippet action()}
          <div class="actions">
            <Button variant="quiet" onclick={() => (showWhy = !showWhy)}>{copy.today.why}</Button>
            <Button onclick={() => answerBreak(false)}>{copy.session.breakNo}</Button>
            <Button variant="primary" onclick={() => answerBreak(true)}>{copy.session.breakYes}</Button>
          </div>
        {/snippet}
      </InlineNotice>
    {/if}

    <div class="controls">
      <Button size="lg" onclick={togglePause}>{running ? copy.session.pause : copy.session.resume}</Button>
      <Button size="lg" variant="quiet" onclick={end}>{copy.session.end}</Button>
    </div>

    {#if active.block.kind === 'reading'}
      <TextField
        label={copy.session.pageReached}
        type="number"
        inputmode="numeric"
        value={active.pageReached}
        hint={copy.session.pageHint}
        oninput={setPage}
      />
    {/if}
  {/if}

  <ConfirmDialog
    bind:open={confirmEnd}
    title={copy.session.endEarlyTitle}
    message={copy.session.endEarlyBody(activeMinutes(active.timer, now))}
    confirmLabel={copy.session.endEarlyYes}
    cancelLabel={copy.session.endEarlyNo}
    onconfirm={() => void finish()}
    oncancel={() => void dontLog()}
  />
{/if}

<style>
  .head {
    display: grid;
    gap: var(--space-2);
  }

  .meta,
  .detail,
  .muted {
    color: var(--color-text-secondary);
  }

  .meta {
    font-size: var(--text-sm);
  }

  .title {
    font-size: var(--text-xl);
  }

  .detail {
    font-family: var(--font-mono);
  }

  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-5);
    min-height: var(--target-min);
  }

  .state {
    font-weight: var(--font-weight-medium);
  }

  .timer {
    display: grid;
    place-items: center;
    padding: var(--space-4) 0;
  }

  .controls {
    display: flex;
    justify-content: center;
    gap: var(--space-4);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .reasons,
  .lesson ul {
    margin: 0;
    padding-left: var(--space-5);
  }

  .lesson {
    display: grid;
    gap: var(--space-3);
  }

  .lesson h2 {
    font-size: var(--text-md);
  }
</style>
