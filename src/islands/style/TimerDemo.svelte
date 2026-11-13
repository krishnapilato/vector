<script lang="ts">
  import Timer from '../../components/Timer.svelte'

  const totalMs = 30 * 60_000
  const startedAt = Date.now() - 11 * 60_000
  let now = $state(Date.now())

  $effect(() => {
    const id = setInterval(() => {
      now = Date.now()
    }, 1000)
    return () => clearInterval(id)
  })

  const remainingMs = $derived(Math.max(0, totalMs - (now - startedAt)))
</script>

<div class="timers">
  <figure>
    <Timer {remainingMs} {totalMs} />
    <figcaption>Hidden (default): hold 2 s to show</figcaption>
  </figure>
  <figure>
    <Timer {remainingMs} {totalMs} alwaysShow />
    <figcaption>Always shown (setting)</figcaption>
  </figure>
  <figure>
    <Timer remainingMs={8 * 60_000 + 12_000} {totalMs} paused alwaysShow />
    <figcaption>Paused</figcaption>
  </figure>
</div>

<style>
  .timers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
  }

  figure {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
  }

  figcaption {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
</style>
