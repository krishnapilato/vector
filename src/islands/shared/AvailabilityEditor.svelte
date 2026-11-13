<script lang="ts">
  import Button from '../../components/Button.svelte'
  import type { Availability, Window } from '../../core/model/schemas'
  import { windows } from '../../core/model/schemas'
  import { copy } from '../../lib/copy'

  interface Props {
    value: Availability
  }

  let { value = $bindable() }: Props = $props()

  function setSlot(day: number, index: number, patch: Partial<{ window: Window; blocks: number }>) {
    value = value.map((slots, d) =>
      d === day ? slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) : slots,
    )
  }

  function addSlot(day: number) {
    const used = new Set(value[day]?.map((s) => s.window))
    const window = windows.find((w) => !used.has(w)) ?? 'evening'
    value = value.map((slots, d) => (d === day ? [...slots, { window, blocks: 1 }] : slots))
  }

  function removeSlot(day: number, index: number) {
    value = value.map((slots, d) => (d === day ? slots.filter((_, i) => i !== index) : slots))
  }
</script>

<div class="week">
  {#each copy.settings.days as dayName, day (dayName)}
    <fieldset class="day">
      <legend>{dayName}</legend>
      {#each value[day] ?? [] as slot, index (index)}
        <div class="slot">
          <label class="visually-hidden" for="w-{day}-{index}">{dayName}: {copy.settings.availability}</label>
          <select
            id="w-{day}-{index}"
            value={slot.window}
            onchange={(e) => setSlot(day, index, { window: e.currentTarget.value as Window })}
          >
            {#each windows as w (w)}<option value={w}>{copy.window[w]}</option>{/each}
          </select>
          <label class="visually-hidden" for="b-{day}-{index}">{dayName}: {copy.settings.blocks}</label>
          <select
            id="b-{day}-{index}"
            value={slot.blocks}
            onchange={(e) => setSlot(day, index, { blocks: Number(e.currentTarget.value) })}
          >
            {#each [1, 2, 3, 4] as n (n)}<option value={n}>{n} × {slot.window === 'commute' ? 15 : 30} min</option>{/each}
          </select>
          <Button variant="quiet" onclick={() => removeSlot(day, index)}>{copy.settings.removeSlot}</Button>
        </div>
      {/each}
      {#if (value[day]?.length ?? 0) < windows.length}
        <div><Button variant="quiet" onclick={() => addSlot(day)}>{copy.settings.addSlot}</Button></div>
      {/if}
    </fieldset>
  {/each}
</div>

<style>
  .week {
    display: grid;
    gap: var(--space-3);
  }

  .day {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3) 0;
    border: 0;
    border-bottom: var(--border-thin) solid var(--color-rule);
    min-width: 0;
  }

  legend {
    padding: 0;
    font-weight: var(--font-weight-medium);
  }

  .slot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  select {
    min-height: var(--target-min);
    padding: 0 var(--space-3);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
  }
</style>
