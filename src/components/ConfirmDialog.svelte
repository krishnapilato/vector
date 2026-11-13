<script lang="ts">
  import { copy } from '../lib/copy'
  import Button from './Button.svelte'

  interface Props {
    open?: boolean
    title: string
    message?: string
    confirmLabel: string
    cancelLabel?: string
    onconfirm: () => void
  }

  let {
    open = $bindable(false),
    title,
    message,
    confirmLabel,
    cancelLabel = copy.dialog.cancel,
    onconfirm,
  }: Props = $props()

  const uid = $props.id()
  let dialog: HTMLDialogElement | undefined = $state()

  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  })

  function confirm() {
    onconfirm()
    open = false
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="{uid}-title"
  aria-describedby={message ? `${uid}-message` : undefined}
  onclose={() => (open = false)}
>
  <h2 id="{uid}-title">{title}</h2>
  {#if message}<p id="{uid}-message">{message}</p>{/if}
  <div class="actions">
    <Button variant="secondary" onclick={() => (open = false)}>{cancelLabel}</Button>
    <Button variant="primary" onclick={confirm}>{confirmLabel}</Button>
  </div>
</dialog>

<style>
  dialog {
    width: min(26rem, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-5);
    border: var(--border-thin) solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-raised);
    color: var(--color-text);
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateY(4px);
    transition:
      opacity var(--duration-base) var(--ease),
      transform var(--duration-base) var(--ease),
      overlay var(--duration-base) allow-discrete,
      display var(--duration-base) allow-discrete;
  }

  dialog[open] {
    display: grid;
    gap: var(--space-4);
    opacity: 1;
    transform: none;
  }

  @starting-style {
    dialog[open] {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  dialog::backdrop {
    background: oklch(25% 0.03 258 / 0.28);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
