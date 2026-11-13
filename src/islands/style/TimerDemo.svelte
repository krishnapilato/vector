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

  const elapsedMs = $derived(Math.min(totalMs, now - startedAt))
</script>

<div class="timers">
  <figure>
    <Timer remainingMs={totalMs - elapsedMs} {elapsedMs} progress={elapsedMs / totalMs} />
    <figcaption>Hidden (default): tap to see it for 3 s</figcaption>
  </figure>
  <figure>
    <Timer remainingMs={totalMs - elapsedMs} {elapsedMs} progress={elapsedMs / totalMs} alwaysShow />
    <figcaption>Always shown (setting)</figcaption>
  </figure>
  <figure>
    <Timer remainingMs={null} {elapsedMs} progress={0} alwaysShow paused />
    <figcaption>Open session, paused</figcaption>
  </figure>
</div>

<style>
  .timers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    gap: var(--space-6);
  }

  figure {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    margin: 0;
  }

  figcaption {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
</style>
