<script lang="ts">
  import ScaleChoice from '../../components/ScaleChoice.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import Switch from '../../components/Switch.svelte'
  import TextField from '../../components/TextField.svelte'

  const modes = [
    { value: 'desk', label: 'Desk' },
    { value: 'on-the-go', label: 'On the go' },
    { value: 'simulator', label: 'Simulator' },
  ] as const

  const sensitivities = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
  ] as const

  let clarity = $state(4)
  let mode = $state<(typeof modes)[number]['value']>('desk')
  let sensitivity = $state<(typeof sensitivities)[number]['value']>('normal')
  let camera = $state(true)
  let sounds = $state(false)
  let page = $state<number | null>(124)
  let note = $state('')
  const pageInvalid = $derived(
    page !== null && (page < 112 || page > 140)
      ? 'Chapter 4 runs from page 112 to 140.'
      : undefined,
  )
</script>

<div class="grid">
  <div class="stack">
    <h3>Scale 1–5</h3>
    <ScaleChoice name="clarity-demo" bind:value={clarity} />
    <ScaleChoice name="clarity-disabled" value={2} disabled legend="Disabled" />
  </div>

  <div class="stack">
    <h3>Segmented control</h3>
    <SegmentedControl name="mode-demo" legend="Mode" options={modes} bind:value={mode} />
    <SegmentedControl
      name="sensitivity-demo"
      legend="Camera sensitivity"
      options={sensitivities}
      bind:value={sensitivity}
    />
  </div>

  <div class="stack">
    <h3>Text field</h3>
    <TextField
      label="I got to page"
      type="number"
      inputmode="numeric"
      bind:value={page}
      hint="Optional. We estimated it from your reading pace."
      {...pageInvalid ? { invalid: pageInvalid } : {}}
    />
    <TextField label="Note" bind:value={note} placeholder="One line, if you like" />
    <TextField label="Pages per 30 minutes" type="number" value={6} suffix="pages" disabled />
  </div>

  <div class="stack">
    <h3>Switch</h3>
    <Switch
      label="Camera"
      description="Analysed on this device only. No images are saved."
      bind:checked={camera}
    />
    <Switch label="Soft sound at the end" bind:checked={sounds} />
    <Switch label="Show the timer all the time" disabled />
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    gap: var(--space-6) var(--space-7);
  }

  .stack {
    display: grid;
    align-content: start;
    gap: var(--space-5);
  }

  h3 {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }
</style>
