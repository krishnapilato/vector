<script lang="ts">
  import Button from '../../components/Button.svelte'
  import ConfirmDialog from '../../components/ConfirmDialog.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import Switch from '../../components/Switch.svelte'
  import TextField from '../../components/TextField.svelte'
  import type { MergeSummary } from '../../core/backup/merge'
  import { localDate } from '../../core/calendar/dates'
  import type { FrameSample } from '../../core/focus/focus'
  import type { Availability, Sensitivity, Settings, Snapshot } from '../../core/model/schemas'
  import { copy, formatLongDate, relativeTime } from '../../lib/copy'
  import { generatePassphrase, passphraseProblem, WrongPassphrase } from '../../lib/crypto'
  import { db } from '../../lib/db'
  import { live } from '../../lib/live.svelte'
  import { go, href } from '../../lib/nav'
  import {
    deleteEverything,
    getSettings,
    mergeIn,
    previewMerge,
    requestPersistence,
    saveSettings,
  } from '../../lib/repo'
  import AvailabilityEditor from '../shared/AvailabilityEditor.svelte'
  import CameraCheck from './CameraCheck.svelte'

  let s = $state<Settings | null>(null)
  let savedNote = $state(false)
  let persistent = $state<boolean | null>(null)

  // Plan settings, edited as a draft and saved together.
  let availability = $state<Availability>([])
  let targetDate = $state<string | number | null>('')
  let pace = $state<string | number | null>(6)
  let blockMinutes = $state<string | number | null>(30)
  let book = $state<string | number | null>(60)
  let exercises = $state<string | number | null>(25)
  let simulator = $state<string | number | null>(15)
  let unlock = $state<string | number | null>(3)

  $effect(() => {
    void (async () => {
      const loaded = await getSettings()
      s = loaded
      availability = structuredClone(loaded.availability)
      targetDate = loaded.targetDate ?? ''
      pace = loaded.pagesPer30
      blockMinutes = loaded.blockMinutes
      book = Math.round(loaded.split.book * 100)
      exercises = Math.round(loaded.split.exercises * 100)
      simulator = Math.round(loaded.split.simulator * 100)
      unlock = loaded.simUnlockAfter
      persistent = await requestPersistence()
    })()
  })

  const n = (v: string | number | null, fallback: number) => {
    const x = Number(v)
    return v === '' || v === null || !Number.isFinite(x) ? fallback : x
  }
  const splitTotal = $derived(n(book, 0) + n(exercises, 0) + n(simulator, 0))

  async function savePlan() {
    if (!s || splitTotal !== 100) return
    s = await saveSettings({
      availability: $state.snapshot(availability) as Availability,
      targetDate:
        typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
          ? targetDate
          : null,
      pagesPer30: Math.min(40, Math.max(1, n(pace, s.pagesPer30))),
      blockMinutes: Math.min(90, Math.max(10, Math.round(n(blockMinutes, s.blockMinutes)))),
      split: {
        book: n(book, 60) / 100,
        exercises: n(exercises, 25) / 100,
        simulator: n(simulator, 15) / 100,
      },
      simUnlockAfter: Math.min(10, Math.max(0, Math.round(n(unlock, 3)))),
    })
    savedNote = true
    setTimeout(() => (savedNote = false), 3000)
  }

  async function toggle(patch: Partial<Settings>) {
    s = await saveSettings(patch)
  }

  /** Turning the camera on asks the browser for permission right away. */
  async function toggleCamera(on: boolean) {
    calibrationProblem = null
    if (!on) {
      s = await saveSettings({ camera: false })
      return
    }
    const camera = await import('../../lib/camera')
    const answer = await camera.askPermission()
    if (answer !== 'granted') {
      calibrationProblem = copy.session.camera[answer]
      s = await saveSettings({ camera: false })
      return
    }
    s = await saveSettings({ camera: true })
    void camera.warmModels()
  }

  // Calibration, here or at the first desk session (§7.3).
  const calibrations = live(() => db.calibrations.toArray(), [])
  const currentCalibration = $derived(calibrations.value.find((c) => c.station === s?.station))
  let station = $state<string | number | null>('')
  $effect(() => {
    if (s && station === '') station = s.station
  })
  let calibrating = $state(false)
  let calibrationProblem = $state<string | null>(null)

  async function calibrate() {
    if (!s) return
    const name =
      String(station ?? '')
        .trim()
        .slice(0, 40) || s.station
    s = await saveSettings({ station: name })
    calibrating = true
    calibrationProblem = null
    const [{ startCamera }, focus] = await Promise.all([
      import('../../lib/camera'),
      import('../../core/focus/focus'),
    ])
    const samples: FrameSample[] = []
    const handle = await startCamera(
      (sample) => {
        samples.push(sample)
      },
      (reason) => {
        calibrationProblem = copy.session.camera[reason]
      },
      { extras: s.extraSignals !== false },
    )
    if (!handle) {
      calibrating = false
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 20_000))
    handle.stop()
    const result = focus.calibrate(name, samples, Date.now())
    samples.length = 0
    if (result) await db.calibrations.put(result)
    else calibrationProblem = copy.settings.calibrationFailed
    calibrating = false
  }

  // Backup files (ADR 0004).
  let passphrase = $state<string | number | null>('')
  let exportMessage = $state<string | null>(null)
  let importFile = $state<File | null>(null)
  let importPass = $state<string | number | null>('')
  let importMessage = $state<{ tone: 'success' | 'attention'; text: string } | null>(null)
  let pending = $state<{ snapshot: Snapshot; summary: MergeSummary } | null>(null)
  const passProblem = $derived(
    String(passphrase ?? '') !== '' && passphraseProblem(String(passphrase))
      ? copy.settings.passphraseShort
      : undefined,
  )

  async function exportBackup() {
    if (passProblem) return
    const { buildBackup, shareOrDownload } = await import('../../lib/backup')
    const file = await buildBackup(String(passphrase ?? '').trim() || null)
    await shareOrDownload(file)
    exportMessage = copy.settings.exported
    s = await getSettings()
  }

  async function readImport() {
    if (!importFile) return
    importMessage = null
    pending = null
    const { readBackup } = await import('../../lib/backup')
    try {
      const r = await readBackup(importFile, String(importPass ?? '').trim() || null)
      if (r.kind === 'needs-passphrase')
        importMessage = { tone: 'attention', text: copy.settings.importNeedsPassphrase }
      else if (r.kind === 'invalid')
        importMessage = { tone: 'attention', text: copy.settings.importInvalid }
      else if (r.kind === 'too-big')
        importMessage = { tone: 'attention', text: copy.settings.importTooBig }
      else pending = { snapshot: r.snapshot, summary: await previewMerge(r.snapshot) }
    } catch (e) {
      importMessage = {
        tone: 'attention',
        text: e instanceof WrongPassphrase ? copy.settings.wrongPassphrase : copy.errors.generic,
      }
    }
  }

  async function confirmImport() {
    if (!pending) return
    await mergeIn(pending.snapshot)
    pending = null
    importMessage = { tone: 'success', text: copy.settings.imported }
    s = await getSettings()
  }

  const summaryLines = (m: MergeSummary) =>
    [
      m.newSessions > 0 ? copy.settings.importSessions(m.newSessions) : '',
      m.chaptersAdvanced.length > 0 ? copy.settings.importChapters(m.chaptersAdvanced.length) : '',
      m.newMilestones > 0 ? copy.settings.importMilestones(m.newMilestones) : '',
      m.activeSession ? copy.settings.importActive : '',
      m.settingsTaken ? copy.settings.importSettings : '',
    ].filter(Boolean)

  // Sync (ADR 0005).
  const sync = live(() => db.sync.get('sync'), undefined)
  let syncPass = $state<string | number | null>('')
  let syncBusy = $state(false)
  let syncMessage = $state<{ tone: 'success' | 'attention'; text: string } | null>(null)
  let deleteRemote = $state(false)
  const syncProblem = $derived(
    String(syncPass ?? '') !== '' && passphraseProblem(String(syncPass))
      ? copy.settings.passphraseShort
      : undefined,
  )

  async function runSync(action: 'enable' | 'now' | 'disable') {
    syncBusy = true
    syncMessage = null
    const { enableSync, syncNow, disableSync, SyncError } = await import('../../lib/sync')
    try {
      if (action === 'enable') {
        if (!String(syncPass ?? '').trim() || syncProblem) return
        await enableSync(String(syncPass).trim())
        syncPass = ''
      } else if (action === 'now') await syncNow()
      else await disableSync(deleteRemote)
      syncMessage = action === 'disable' ? null : { tone: 'success', text: copy.settings.syncDone }
      s = await getSettings()
    } catch (e) {
      const code = e instanceof SyncError ? e.code : 'server'
      if (code === 'locked' && action === 'enable') await disableSync(false)
      syncMessage = {
        tone: 'attention',
        text:
          code === 'offline'
            ? copy.settings.syncOffline
            : code === 'locked' || code === 'forbidden'
              ? copy.settings.syncLocked
              : copy.settings.syncProblem,
      }
    } finally {
      syncBusy = false
    }
  }

  let confirmDelete = $state(false)
  async function wipe() {
    await deleteEverything()
    go('welcome')
  }
</script>

<h1>{copy.settings.title}</h1>

{#if !s}
  <p role="status">{copy.app.loading}</p>
{:else}
  <section class="group" aria-labelledby="plan-title">
    <h2 id="plan-title">{copy.settings.availability}</h2>
    <p class="muted">{copy.settings.availabilityHint}</p>
    <AvailabilityEditor bind:value={availability} />
    <label class="field">
      <span>{copy.settings.targetDate}</span>
      <input type="date" bind:value={targetDate} />
      <span class="muted small">{copy.settings.targetHint}</span>
    </label>
    <div class="pair">
      <TextField label={copy.settings.pace} type="number" inputmode="decimal" bind:value={pace} suffix={copy.settings.paceUnit} hint={copy.settings.paceHint} />
      <TextField label={copy.settings.blockMinutes} type="number" inputmode="numeric" bind:value={blockMinutes} suffix={copy.settings.minutesUnit} />
    </div>
    <fieldset class="split">
      <legend>{copy.settings.split}</legend>
      <TextField label={copy.settings.splitBook} type="number" inputmode="numeric" bind:value={book} suffix="%" />
      <TextField label={copy.settings.splitExercises} type="number" inputmode="numeric" bind:value={exercises} suffix="%" />
      <TextField label={copy.settings.splitSimulator} type="number" inputmode="numeric" bind:value={simulator} suffix="%" />
    </fieldset>
    {#if splitTotal !== 100}<InlineNotice tone="attention">{copy.settings.splitProblem}</InlineNotice>{/if}
    <TextField label={copy.settings.simUnlock} type="number" inputmode="numeric" bind:value={unlock} suffix={copy.settings.simUnlockUnit} />
    <div class="row">
      <Button variant="primary" disabled={splitTotal !== 100} onclick={savePlan}>{copy.settings.save}</Button>
      {#if savedNote}<span class="muted" role="status">{copy.settings.saved}</span>{/if}
    </div>
    <p class="muted small">{copy.plan.regenerate}: <a href={href('plan')}>{copy.nav.plan}</a></p>
  </section>

  <section class="group" aria-labelledby="camera-title">
    <h2 id="camera-title">{copy.settings.camera}</h2>
    <Switch label={copy.settings.camera} description={copy.settings.cameraHint} checked={s.camera} onchange={(v) => void toggleCamera(v)} />
    <Switch
      label={copy.settings.extraSignals}
      description={copy.settings.extraSignalsHint}
      checked={s.extraSignals !== false}
      onchange={(v) => toggle({ extraSignals: v })}
    />
    <Switch
      label={copy.settings.softPreview}
      description={copy.settings.softPreviewHint}
      checked={s.softPreview === true}
      onchange={(v) => toggle({ softPreview: v })}
    />
    <SegmentedControl
      name="sensitivity"
      legend={copy.settings.sensitivity}
      options={(['low', 'normal', 'high'] as const).map((v) => ({ value: v, label: copy.settings.sensitivities[v] }))}
      value={s.sensitivity}
      onchange={(v: Sensitivity) => toggle({ sensitivity: v })}
    />
    <TextField label={copy.settings.station} bind:value={station} hint={copy.settings.stationHint} />
    <p class="muted small">
      {currentCalibration ? copy.settings.calibrated(formatLongDate(localDate(currentCalibration.date))) : copy.settings.notCalibrated}
    </p>
    <p class="small">{copy.settings.calibrateBody}</p>
    <div class="row">
      <Button disabled={calibrating} onclick={calibrate}>{calibrating ? copy.settings.calibrating : copy.settings.calibrate}</Button>
    </div>
    {#if calibrationProblem}<InlineNotice tone="attention" live>{calibrationProblem}</InlineNotice>{/if}
    {#if s.camera}<CameraCheck calibration={currentCalibration} sensitivity={s.sensitivity} extras={s.extraSignals !== false} />{/if}
    <p><a href={href('settings/privacy')}>{copy.settings.privacyLink}</a></p>
  </section>

  <section class="group" aria-labelledby="session-title">
    <h2 id="session-title">{copy.kind.reading} · {copy.nav.today}</h2>
    <Switch label={copy.settings.sounds} checked={s.sounds} onchange={(v) => toggle({ sounds: v })} />
    <Switch label={copy.settings.showTimer} checked={s.alwaysShowTimer} onchange={(v) => toggle({ alwaysShowTimer: v })} />
    <Switch label={copy.settings.pauseWhenAway} checked={s.pauseWhenAway} onchange={(v) => toggle({ pauseWhenAway: v })} />
  </section>

  <section class="group" aria-labelledby="sync-title">
    <h2 id="sync-title">{copy.settings.sync}</h2>
    <p class="muted">{copy.settings.syncHint}</p>
    {#if sync.value}
      <p>{copy.settings.syncEnabled} {sync.value.lastSyncAt ? copy.settings.syncLast(relativeTime(sync.value.lastSyncAt)) : copy.settings.syncNever}</p>
      <div class="row">
        <Button disabled={syncBusy} onclick={() => runSync('now')}>{syncBusy ? copy.settings.syncing : copy.settings.syncNow}</Button>
      </div>
      <label class="check"><input type="checkbox" bind:checked={deleteRemote} /> {copy.settings.syncDeleteRemote}</label>
      <div class="row"><Button variant="quiet" disabled={syncBusy} onclick={() => runSync('disable')}>{copy.settings.syncOff}</Button></div>
    {:else}
      <TextField label={copy.settings.passphrase} bind:value={syncPass} {...syncProblem ? { invalid: syncProblem } : {}} />
      <div class="row">
        <Button variant="quiet" onclick={() => (syncPass = generatePassphrase())}>{copy.settings.generate}</Button>
        <Button variant="primary" disabled={syncBusy || !String(syncPass ?? '').trim() || !!syncProblem} onclick={() => runSync('enable')}>
          {syncBusy ? copy.settings.syncing : copy.settings.syncOn}
        </Button>
      </div>
    {/if}
    {#if syncMessage}<InlineNotice tone={syncMessage.tone} live>{syncMessage.text}</InlineNotice>{/if}
  </section>

  <section class="group" aria-labelledby="backup-title">
    <h2 id="backup-title">{copy.settings.backup}</h2>
    <p class="muted">{copy.settings.backupHint}</p>
    <TextField label={copy.settings.passphrase} bind:value={passphrase} hint={copy.settings.passphraseHint} {...passProblem ? { invalid: passProblem } : {}} />
    <div class="row">
      <Button variant="quiet" onclick={() => (passphrase = generatePassphrase())}>{copy.settings.generate}</Button>
      <Button variant="primary" disabled={!!passProblem} onclick={exportBackup}>{copy.settings.export}</Button>
    </div>
    {#if exportMessage}<p class="muted" role="status">{exportMessage}</p>{/if}

    <label class="field">
      <span>{copy.settings.import}</span>
      <input
        type="file"
        accept="application/json,.json"
        onchange={(e) => {
          importFile = e.currentTarget.files?.[0] ?? null
          void readImport()
        }}
      />
    </label>
    {#if importMessage?.text === copy.settings.importNeedsPassphrase || importMessage?.text === copy.settings.wrongPassphrase}
      <TextField label={copy.settings.passphrase} bind:value={importPass} />
      <div class="row"><Button onclick={readImport}>{copy.settings.import}</Button></div>
    {/if}
    {#if pending}
      {@const lines = summaryLines(pending.summary)}
      <div class="preview">
        {#if lines.length === 0}
          <p>{copy.settings.importNothing}</p>
        {:else}
          <p>{copy.settings.importPreview}</p>
          <ul>{#each lines as line}<li>{line}</li>{/each}</ul>
          <div class="row"><Button variant="primary" onclick={confirmImport}>{copy.settings.importConfirm}</Button></div>
        {/if}
      </div>
    {/if}
    {#if importMessage}<InlineNotice tone={importMessage.tone} live>{importMessage.text}</InlineNotice>{/if}
    <p class="muted small">{persistent ? copy.settings.persistent : copy.settings.notPersistent}</p>
  </section>

  <section class="group" aria-labelledby="delete-title">
    <h2 id="delete-title">{copy.settings.deleteAll}</h2>
    <p class="muted">{copy.settings.deleteAllBody}</p>
    <div><Button onclick={() => (confirmDelete = true)}>{copy.settings.deleteAll}</Button></div>
  </section>

  <ConfirmDialog
    bind:open={confirmDelete}
    title={copy.settings.deleteAll}
    message={copy.settings.deleteAllBody}
    confirmLabel={copy.settings.deleteAllConfirm}
    onconfirm={() => void wipe()}
  />
{/if}

<style>
  .group {
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-5);
    border-top: var(--border-thin) solid var(--color-border);
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .small {
    font-size: var(--text-sm);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-3);
  }

  .split {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .split legend {
    padding: 0;
    margin-bottom: var(--space-2);
    font-weight: var(--font-weight-medium);
  }

  .field {
    display: grid;
    gap: var(--space-2);
    font-weight: var(--font-weight-medium);
  }

  .field input[type='date'] {
    min-height: var(--target-min);
    max-width: 14rem;
    padding: 0 var(--space-3);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font-family: var(--font-mono);
    font-weight: var(--font-weight-regular);
  }

  .field input[type='file'] {
    width: 100%;
    min-width: 0;
    min-height: var(--target-min);
    font-weight: var(--font-weight-regular);
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-min);
  }

  .check input {
    width: 1.25rem;
    height: 1.25rem;
  }

  .preview {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    border: var(--border-thin) solid var(--color-border);
  }

  .preview ul {
    margin: 0;
    padding-left: var(--space-5);
  }
</style>
