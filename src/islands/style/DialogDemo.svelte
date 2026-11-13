<script lang="ts">
  import Button from '../../components/Button.svelte'
  import ConfirmDialog from '../../components/ConfirmDialog.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'

  let open = $state(false)
  let answer = $state<string | null>(null)
</script>

<div class="demo">
  <Button onclick={() => (open = true)}>End early</Button>
  {#if answer}
    <InlineNotice tone="success" live>{answer}</InlineNotice>
  {/if}
</div>

<ConfirmDialog
  bind:open
  title="Log the minutes you did?"
  message="18 active minutes so far. They count towards this week."
  confirmLabel="Log 18 minutes"
  cancelLabel="Keep going"
  onconfirm={() => (answer = '18 minutes logged.')}
/>

<style>
  .demo {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }
</style>
