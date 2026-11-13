<script lang="ts">
  import Button from '../../components/Button.svelte'
  import ConfirmDialog from '../../components/ConfirmDialog.svelte'
  import InlineAlert from '../../components/InlineAlert.svelte'

  let open = $state(false)
  let answer = $state<string | null>(null)
</script>

<div class="demo">
  <Button onclick={() => (open = true)}>Delete all data</Button>
  {#if answer}<InlineAlert tone="success" live>{answer}</InlineAlert>{/if}
</div>

<ConfirmDialog
  bind:open
  title="Delete every session, profile and setting on this device?"
  message="This can’t be undone. Export a backup first if you want to keep anything."
  confirmLabel="Continue"
  onconfirm={() => (answer = 'Confirmed (demo only, nothing was deleted).')}
/>

<style>
  .demo {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }
</style>
