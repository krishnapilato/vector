<!--
  Settings (PIANO-V3-LITE §4.3): the session, the camera and posture profiles, and your data.
  Every change is saved at once.
-->
<script lang="ts">
  import Button from '../../components/Button.svelte'
  import ConfirmDialog from '../../components/ConfirmDialog.svelte'
  import InlineAlert from '../../components/InlineAlert.svelte'
  import Loading from '../../components/Loading.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import Switch from '../../components/Switch.svelte'
  import TextField from '../../components/TextField.svelte'
  import type { FrameSample } from '../../core/focus/focus'
  import { durations } from '../../core/model/defaults'
  import { type Sensitivity, type Settings, sensitivities } from '../../core/model/schemas'
  import { backupFile, download, readBackup } from '../../lib/backup'
  import type { CameraHandle } from '../../lib/camera'
  import { copy } from '../../lib/copy'
  import { passphraseProblem, WrongPassphrase } from '../../lib/crypto'
  import { db } from '../../lib/db'
  import { live } from '../../lib/live.svelte'
  import {
    deleteAll,
    getSettings,
    importBackup,
    requestPersistence,
    saveCalibration,
    saveSettings,
  } from '../../lib/store'

  type Tab = 'session' | 'camera' | 'data' | 'privacy'

  let s = $state<Settings | null>(null)
  /** One section at a time, so each fits on a single screen. */
  let tab = $state<Tab>(
    typeof window !== 'undefined' && window.location.hash === '#privacy' ? 'privacy' : 'session',
  )
  let persistent = $state<boolean | null>(null)

  $effect(() => {
    void (async () => {
      s = await getSettings()
      persistent = await requestPersistence()
    })()
  })

  async function change(patch: Partial<Omit<Settings, 'id'>>) {
    s = await saveSettings(patch)
  }

  // ── Posture profiles ───────────────────────────────────────────────────────
  const profiles = live(
    async () => (await db.calibrations.toArray()).toSorted((a, b) => a.createdAt - b.createdAt),
    [],
  )
  let profileName = $state<string | number | null>('Desk')
  let calibrating = $state(false)
  let calibrationRequest = 0
  let calibrationHandle: CameraHandle | null = null
  $effect(() => {
    // Stop calibration when switching sections or leaving Settings.
    void tab
    return () => {
      calibrationRequest++
      calibrationHandle?.stop()
      calibrationHandle = null
      calibrating = false
    }
  })
  let calibrationMessage = $state<{ tone: 'success' | 'attention'; text: string } | null>(null)
  let video = $state<HTMLVideoElement>()
  let canvas = $state<HTMLCanvasElement>()

  async function calibrate() {
    if (calibrating) return
    const request = ++calibrationRequest
    const label =
      String(profileName ?? '')
        .trim()
        .slice(0, 40) || 'Desk'
    calibrating = true
    calibrationMessage = null
    const [{ startCamera }, focus] = await Promise.all([
      import('../../lib/camera'),
      import('../../core/focus/focus'),
    ])
    if (request !== calibrationRequest) return
    const samples: FrameSample[] = []
    const handle = await startCamera(
      (sample) => samples.push(sample),
      (reason) => {
        if (request === calibrationRequest)
          calibrationMessage = { tone: 'attention', text: copy.camera[reason] }
      },
      video && canvas ? { video, canvas } : undefined,
    )
    if (request !== calibrationRequest) {
      handle?.stop()
      return
    }
    calibrationHandle = handle
    if (handle) {
      await new Promise((resolve) => setTimeout(resolve, 15_000))
      handle.stop()
      calibrationHandle = null
      if (request !== calibrationRequest) return
      const posture = focus.calibrate(samples)
      if (posture) {
        await saveCalibration({ id: crypto.randomUUID(), label, ...posture, createdAt: Date.now() })
        s = await getSettings()
        calibrationMessage = { tone: 'success', text: copy.settings.calibrated(label) }
      } else calibrationMessage = { tone: 'attention', text: copy.settings.calibrationFailed }
    }
    samples.length = 0
    calibrating = false
  }

  // ── Backup ─────────────────────────────────────────────────────────────────
  let passphrase = $state<string | number | null>('')
  let importedFileName = $state('')
  let importing = $state(false)
  let backupMessage = $state<{ tone: 'success' | 'attention'; text: string } | null>(null)
  const pass = $derived(String(passphrase ?? '').trim())
  const passTooShort = $derived(pass !== '' && passphraseProblem(pass) !== null)

  async function exportFile() {
    if (passTooShort) return
    download(await backupFile(pass || null))
  }

  async function importFile(file: File | undefined) {
    if (!file || importing) return
    importedFileName = file.name
    importing = true
    backupMessage = null
    try {
      const r = await readBackup(file, pass || null)
      if (r.kind === 'ok') {
        const merged = await importBackup(r.backup)
        s = await getSettings()
        backupMessage = { tone: 'success', text: copy.settings.imported(merged.newSessions) }
      } else
        backupMessage = {
          tone: 'attention',
          text:
            r.kind === 'needs-passphrase'
              ? copy.settings.importNeedsPassphrase
              : copy.settings.importInvalid,
        }
    } catch (e) {
      backupMessage = {
        tone: 'attention',
        text: e instanceof WrongPassphrase ? copy.settings.wrongPassphrase : copy.errors.generic,
      }
    } finally {
      importing = false
    }
  }

  // ── Delete everything, with a double confirmation (§4.3) ───────────────────
  let confirmFirst = $state(false)
  let confirmSecond = $state(false)
  let deleted = $state(false)

  async function wipe() {
    await deleteAll()
    s = await getSettings()
    deleted = true
  }
</script>

<h1>{copy.settings.title}</h1>

{#if !s}
  <Loading />
{:else}
  <SegmentedControl
    name="settings-section"
    legend={copy.settings.sections}
    hideLegend
    options={[
      { value: 'session', label: copy.settings.session },
      { value: 'camera', label: copy.settings.cameraTab },
      { value: 'data', label: copy.settings.dataTab },
      { value: 'privacy', label: copy.settings.privacyTab },
    ]}
    bind:value={tab}
  />

  {#if tab === 'session'}
  <section class="group" aria-labelledby="session-title">
    <h2 id="session-title" class="visually-hidden">{copy.settings.session}</h2>
    <SegmentedControl
      name="default-duration"
      legend={copy.settings.defaultDuration}
      options={durations.map((m) => ({ value: String(m), label: copy.focus.durationLabel(m) }))}
      value={String(s.defaultDurationMin)}
      onchange={(v) => change({ defaultDurationMin: Number(v) })}
    />
    <Switch label={copy.settings.alwaysShowTimer} checked={s.alwaysShowTimer} onchange={(v) => change({ alwaysShowTimer: v })} />
    <Switch label={copy.settings.sound} checked={s.soundEnabled} onchange={(v) => change({ soundEnabled: v })} />
  </section>
  {:else if tab === 'camera'}

  <section class="group" aria-labelledby="camera-title">
    <h2 id="camera-title" class="visually-hidden">{copy.settings.camera}</h2>
    <Switch
      label={copy.settings.cameraDefault}
      description={copy.settings.cameraHint}
      checked={s.cameraEnabledByDefault}
      onchange={(v) => change({ cameraEnabledByDefault: v })}
    />
    <SegmentedControl
      name="sensitivity"
      legend={copy.settings.sensitivity}
      options={sensitivities.map((v) => ({ value: v, label: copy.settings.sensitivities[v] }))}
      value={s.sensitivity}
      onchange={(v: Sensitivity) => change({ sensitivity: v })}
    />

    <h3>{copy.settings.profiles}</h3>
    <p class="muted small">{copy.settings.profileHint}</p>
    {#if profiles.value.length === 0}
      <p class="muted small">{copy.settings.noProfiles}</p>
    {:else}
      <SegmentedControl
        name="active-profile"
        legend={copy.settings.activeProfile}
        options={profiles.value.map((p) => ({ value: p.id, label: p.label }))}
        value={s.activeCalibrationId ?? ''}
        onchange={(v) => change({ activeCalibrationId: v })}
      />
    {/if}
    <TextField label={copy.settings.profileName} bind:value={profileName} />
    <div class="frame" hidden={!calibrating}>
      <!-- Shown only while calibrating; never recorded or saved. -->
      <video bind:this={video} muted playsinline></video>
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
    </div>
    <div>
      <Button disabled={calibrating} onclick={calibrate}>
        {calibrating ? copy.settings.calibrating : copy.settings.calibrate}
      </Button>
    </div>
    {#if calibrationMessage}<InlineAlert tone={calibrationMessage.tone} live>{calibrationMessage.text}</InlineAlert>{/if}
  </section>
  {:else if tab === 'data'}

  <section class="group" aria-labelledby="data-title">
    <h2 id="data-title" class="visually-hidden">{copy.settings.data}</h2>
    <p class="muted">{copy.settings.backupHint}</p>
    <TextField
      label={copy.settings.passphrase}
      bind:value={passphrase}
      {...passTooShort ? { invalid: copy.settings.passphraseShort } : {}}
    />
    <div class="row">
      <Button variant="primary" disabled={passTooShort} onclick={exportFile}>{copy.settings.export}</Button>
      <label class="file" class:busy={importing}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
        <span>{importing ? 'Importing…' : copy.settings.import}</span>
        <input type="file" aria-label={copy.settings.import} disabled={importing} accept="application/json,.json" onchange={(e) => { void importFile(e.currentTarget.files?.[0]); e.currentTarget.value = '' }} />
      </label>
    </div>
    {#if importedFileName}<p class="selected-file" role="status">Selected file: {importedFileName}</p>{/if}
    {#if backupMessage}<InlineAlert tone={backupMessage.tone} live>{backupMessage.text}</InlineAlert>{/if}
    <p class="muted small">{persistent ? copy.settings.persistent : copy.settings.notPersistent}</p>
    <div><Button onclick={() => (confirmFirst = true)}>{copy.settings.deleteAll}</Button></div>
    {#if deleted}<InlineAlert tone="success" live>{copy.settings.deleted}</InlineAlert>{/if}
  </section>
  {:else}
  <section class="group" aria-labelledby="privacy-title">
    <h2 id="privacy-title">{copy.privacy.title}</h2>
    <div>
      <!-- Native exclusive accordion: details sharing a name close each other, no script needed. -->
      {#each copy.privacy.items as item (item.title)}
        <details name="privacy">
          <summary>{item.title}</summary>
          <p>{item.body}</p>
        </details>
      {/each}
    </div>
  </section>
  {/if}

  <ConfirmDialog
    bind:open={confirmFirst}
    title={copy.settings.deleteConfirm1}
    confirmLabel={copy.settings.deleteYes}
    onconfirm={() => (confirmSecond = true)}
  />
  <ConfirmDialog
    bind:open={confirmSecond}
    title={copy.settings.deleteAll}
    message={copy.settings.deleteConfirm2}
    confirmLabel={copy.settings.deleteFinal}
    onconfirm={() => void wipe()}
  />
{/if}

<style>
  .group {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-6);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  /* The manifesto: hairlines between items, a chevron that turns when one opens. */
  details {
    border-radius: var(--radius-md);
    transition: background-color var(--duration-fast) var(--ease);
  }

  details[open],
  details:hover {
    background: var(--color-fill);
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--target-min);
    padding: var(--space-2) var(--space-4);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::after {
    content: '';
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    margin-right: var(--space-1);
    border-right: var(--border-medium) solid var(--color-text-secondary);
    border-bottom: var(--border-medium) solid var(--color-text-secondary);
    transform: rotate(45deg);
    transition: transform var(--duration-fast) var(--ease);
  }

  details[open] summary::after {
    transform: rotate(225deg);
  }

  summary:hover {
    color: var(--color-accent);
  }

  details p {
    padding: 0 var(--space-4) var(--space-4);
    color: var(--color-text-secondary);
  }

  h3 {
    margin-top: var(--space-2);
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

  .file {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--target-min);
    padding: 0 var(--space-5);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease);
  }
  .file:hover { background: var(--color-fill); }
  .file:focus-within { outline: 2px solid var(--color-accent); outline-offset: 2px; box-shadow: 0 0 0 4px var(--color-focus-ring); }
  .file svg { width: 1.125rem; height: 1.125rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .file input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
  .file.busy { opacity: 0.5; cursor: wait; }
  .selected-file { font-size: var(--text-xs); color: var(--color-text-secondary); overflow-wrap: anywhere; }

  .frame {
    position: relative;
    width: min(100%, 26rem);
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-text);
  }

  .frame[hidden] {
    display: none;
  }

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
</style>
