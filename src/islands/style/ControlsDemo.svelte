<script lang="ts">
  import RatingSelector from '../../components/RatingSelector.svelte'
  import SegmentedControl from '../../components/SegmentedControl.svelte'
  import Switch from '../../components/Switch.svelte'
  import TextField from '../../components/TextField.svelte'

  let rating = $state(4)
  let duration = $state('30')
  let camera = $state('on')
  let tag = $state<string | number | null>('Deep work')
  let note = $state<string | number | null>('')
  let sound = $state(true)
</script>

<div class="grid">
  <div class="stack">
    <h3>Rating 1–5</h3>
    <RatingSelector name="rating-demo" bind:value={rating} />
    <RatingSelector name="rating-disabled" value={2} disabled legend="Disabled" />
  </div>

  <div class="stack">
    <h3>Segmented control</h3>
    <SegmentedControl
      name="duration-demo"
      legend="Length"
      options={[
        { value: '25', label: '25m' },
        { value: '30', label: '30m' },
        { value: '45', label: '45m' },
        { value: '60', label: '60m' },
        { value: '0', label: 'Open' },
      ]}
      bind:value={duration}
    />
    <SegmentedControl
      name="camera-demo"
      legend="Camera"
      options={[
        { value: 'on', label: 'Camera on' },
        { value: 'off', label: 'Camera off' },
      ]}
      bind:value={camera}
    />
  </div>

  <div class="stack">
    <h3>Text field</h3>
    <TextField label="What are you working on?" bind:value={tag} />
    <TextField label="Note" bind:value={note} placeholder="Optional, e.g. Stopped at page 124" />
    <TextField label="Passphrase (optional)" value="short" invalid="Use at least 5 words or 24 characters." />
    <TextField label="Disabled" value="30" suffix="min" disabled />
  </div>

  <div class="stack">
    <h3>Switch</h3>
    <Switch
      label="Camera on by default"
      description="Frames are analysed on this device and dropped at once."
      bind:checked={sound}
    />
    <Switch label="Always show the timer" disabled />
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
