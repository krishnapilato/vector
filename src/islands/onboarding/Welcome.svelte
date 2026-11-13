<script lang="ts">
  import Button from '../../components/Button.svelte'
  import InlineNotice from '../../components/InlineNotice.svelte'
  import TextField from '../../components/TextField.svelte'
  import type { StartingContent } from '../../core/model/content'
  import { defaultAvailability } from '../../core/model/defaults'
  import type { Availability } from '../../core/model/schemas'
  import { subjectName } from '../../core/model/subjects'
  import { copy } from '../../lib/copy'
  import { go, href } from '../../lib/nav'
  import { completeOnboarding } from '../../lib/repo'
  import AvailabilityEditor from '../shared/AvailabilityEditor.svelte'

  interface Props {
    content: StartingContent
  }

  let { content }: Props = $props()

  let step = $state(1)
  let targetDate = $state<string | number | null>('')
  let availability = $state<Availability>(structuredClone(defaultAvailability))
  let pace = $state<string | number | null>(6)
  let saving = $state(false)

  const provisional = $derived(/provvisorio/i.test(content.edition))

  async function finish() {
    if (saving) return
    saving = true
    const p = Number(pace)
    await completeOnboarding($state.snapshot(content) as StartingContent, {
      targetDate:
        typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
          ? targetDate
          : null,
      availability: $state.snapshot(availability) as Availability,
      pagesPer30: Number.isFinite(p) && p >= 1 && p <= 40 ? p : 6,
    })
    go('')
  }

  function next() {
    if (step < 4) step += 1
    else void finish()
  }
</script>

<header class="head">
  <h1>{copy.welcome.title}</h1>
  <p class="muted">{copy.welcome.intro}</p>
  <p class="step" aria-live="polite">{copy.welcome.step(step)}</p>
</header>

<section class="panel" aria-labelledby="step-title">
  {#if step === 1}
    <h2 id="step-title">{copy.welcome.goalTitle}</h2>
    <p>{copy.welcome.goalBody}</p>
    <label class="date">
      <span>{copy.settings.targetDate}</span>
      <input type="date" bind:value={targetDate} />
    </label>
    <p class="muted small">{copy.welcome.haveBackup} <a href={href('settings')}>{copy.nav.settings}</a></p>
  {:else if step === 2}
    <h2 id="step-title">{copy.welcome.availabilityTitle}</h2>
    <p>{copy.welcome.availabilityBody}</p>
    <AvailabilityEditor bind:value={availability} />
  {:else if step === 3}
    <h2 id="step-title">{copy.welcome.materialsTitle}</h2>
    <p>{copy.welcome.materialsBody}</p>
    {#if provisional}<InlineNotice tone="attention">{copy.welcome.provisional}</InlineNotice>{/if}
    <ol class="chapters">
      {#each content.chapters as c (c.id)}
        <li>
          <span class="num">{c.order}</span>
          <span>{c.title}<br /><span class="muted small">{subjectName(c.subject)} · {copy.materials.pages(c.pageStart, c.pageEnd)}</span></span>
        </li>
      {/each}
    </ol>
  {:else}
    <h2 id="step-title">{copy.welcome.paceTitle}</h2>
    <p>{copy.welcome.paceBody}</p>
    <TextField label={copy.settings.pace} type="number" inputmode="decimal" bind:value={pace} suffix={copy.settings.paceUnit} min={1} max={40} />
  {/if}
</section>

<div class="nav">
  {#if step > 1}<Button variant="quiet" onclick={() => (step -= 1)}>{copy.welcome.back}</Button>{/if}
  <span class="spacer"></span>
  {#if step < 4}<Button variant="quiet" onclick={next}>{copy.welcome.skip}</Button>{/if}
  <Button variant="primary" disabled={saving} onclick={next}>{step < 4 ? copy.welcome.next : copy.welcome.finish}</Button>
</div>

<style>
  .head,
  .panel {
    display: grid;
    gap: var(--space-3);
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .small {
    font-size: var(--text-sm);
  }

  .step {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-accent);
  }

  .date {
    display: grid;
    gap: var(--space-2);
    font-weight: var(--font-weight-medium);
  }

  .date input {
    min-height: var(--target-min);
    max-width: 14rem;
    padding: 0 var(--space-3);
    border: var(--border-thin) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font-family: var(--font-mono);
  }

  .chapters {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: var(--border-thin) solid var(--color-rule);
  }

  .chapters li {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: var(--border-thin) solid var(--color-rule);
  }

  .num {
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .spacer {
    flex: 1;
  }
</style>
