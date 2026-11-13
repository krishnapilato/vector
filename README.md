# Vector

A calm study companion for the EASA PPL(A) theory. Vector plans how much to study each month,
week and day, walks you through focused 30-minute blocks, and keeps a logbook of everything you
did. It has no quizzes and no book inside: you read the Trebbi on paper and take quizzes on
quizppl.it; Vector plans, accompanies and records.

## What it does

- **Today**: the next block, ready, and one Start button. "I only have 10 minutes" for short gaps.
- **Session**: a timer that survives closing the browser, hidden by default (hold to see it).
  At a desk, the camera notices distraction and tiredness and offers a break, with a "Why?".
- **Wrap-up** in 10 seconds: clarity 1–5, page reached, a note; quiz score or flight outcome.
- **Plan**: week and month, explained block by block, regenerated with a preview, exported to
  Google Calendar (.ics) for reminders. Spaced reviews, quizzes only after understanding, the
  simulator as the week's reward, skipped blocks redistributed without a backlog.
- **Logbook, milestones, weekly review**: honest progress, no streaks or points.
- **Backup and sync**: a JSON file (optionally encrypted) to move between devices, merged without
  ever losing progress, or end-to-end encrypted sync with a passphrase.

## Privacy

Everything lives in your browser (IndexedDB). Camera frames are analysed on the device by
MediaPipe models served by the app itself and dropped at once; only numeric totals per session are
saved. A Content Security Policy makes the browser refuse any other connection; the only exception
is the sync server, used only if you turn sync on, and it stores ciphertext it cannot read.
Details in the app under Settings → Privacy.

## Development

Requires Node (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev      # http://localhost:4321/vector/
pnpm check    # typecheck, lint, unit tests, build, JS budget
pnpm e2e      # end-to-end and accessibility tests (Playwright, fake camera)
```

Stack: Astro (static) with Svelte 5 islands, TypeScript strictest, Dexie, Zod, MediaPipe Tasks
Vision, Biome, Vitest, Playwright + axe-core. Pure logic lives in `src/core` and is unit-tested.

The plan is in [docs/PIANO-V3.md](docs/PIANO-V3.md) and the decisions in
[docs/decisions/](docs/decisions/). The previous version is kept under the `v2-final` tag.

## License

MIT, see [LICENSE](LICENSE).
