<script lang="ts">
  import { copy } from '../lib/copy'

  interface Props {
    state: 'active' | 'paused' | 'off'
  }

  let { state }: Props = $props()
</script>

<p class="camera {state}" role="status">
  <span class="dot" aria-hidden="true"></span>
  {copy.session.camera[state]}
</p>

<style>
  .camera {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    border: var(--border-medium) solid currentcolor;
  }

  .active .dot {
    border-color: var(--color-success);
    background: var(--color-success);
    box-shadow: 0 0 0 3px var(--color-success-soft);
  }

  .paused .dot {
    border-color: var(--color-attention);
    background: var(--color-attention-soft);
  }
</style>
