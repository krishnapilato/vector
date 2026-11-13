<script lang="ts">
  import { copy } from '../lib/copy'
</script>

<div class="loading" role="status">
  <span class="visually-hidden">{copy.app.loading}</span>
  <div class="skeleton" aria-hidden="true">
    <span class="line title"></span>
    <span class="line subtitle"></span>
    <div class="loading-card">
      <span class="line label"></span><span class="line field"></span>
      <span class="line label"></span><span class="line field"></span>
      <span class="line action"></span>
    </div>
  </div>
</div>

<style>
  .loading { width: min(100%, 36rem); margin: auto; }
  .skeleton { display: grid; gap: var(--space-4); animation: breathe 1.8s ease-in-out infinite alternate; }
  .line { display: block; background: var(--color-fill-strong); border-radius: var(--radius-sm); }
  .title { width: 45%; height: 2.25rem; }
  .subtitle { width: 65%; height: 0.875rem; }
  .loading-card { display: grid; gap: var(--space-4); padding: var(--space-6); margin-top: var(--space-4); background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  .label { width: 35%; height: 0.75rem; }
  .field { height: 3rem; }
  .action { height: 3rem; margin-top: var(--space-3); background: var(--color-accent-soft); }
  @keyframes breathe { from { opacity: 0.5; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
