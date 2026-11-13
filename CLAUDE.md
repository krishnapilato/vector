# Vector — working rules for Claude Code

The full plan is [docs/PIANO-V3.md](docs/PIANO-V3.md) (Italian). Read it before writing code.
Decisions live in [docs/decisions/](docs/decisions/). The first public release is **v1.0.0**
(ADR 0001); "v3" is only the name of the plan and of the integration branch.

## How to work

1. One phase at a time (plan §14), in order. A phase is done only when all its acceptance
   criteria pass and `pnpm check` is green.
2. At phases marked ⛔ GATE (F1, F3, F5) stop and ask Krishna to try and approve before going on.
3. **Do not add features that are not in the plan.** If something seems missing, write it in
   `docs/proposte.md` and ask. v2 failed because it had too many features.
4. When the plan leaves a technical choice open, pick the simplest option and record it as a short
   ADR in `docs/decisions/`.
5. Check up-to-date docs (Context7 or official docs) before using a library. Pin exact versions.
   `pnpm-workspace.yaml` refuses releases younger than 3 days: pick the newest version past that.
6. All UI text follows the tone of plan §10 and lives in `src/lib/copy.ts`. English only.
7. Small, descriptive commits in English. One branch per phase (`v3-f1-design`, …) merged into
   `v3` when the phase closes. (Git cannot hold both `v3` and `v3/…`, hence the dash.)

## Strictness

- TypeScript `strictest` (no unused locals/parameters, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`). `astro check` and `svelte-check` fail on warnings.
- Biome fails on warnings; unused variables, imports and parameters are errors.
- No dead code, no commented-out code, no unused dependencies.

## Principles (plan §2, binding)

- Privacy by construction: all data stays in the browser (IndexedDB). Camera frames are analysed
  in memory and dropped; only numeric aggregates per session are stored. Models are served by the
  app, never fetched from third parties.
- Zero friction: 1 tap from Today to a running session; wrap-up in at most 10 seconds.
- Healthy motivation: weekly flexible goals, no streaks, points or guilt.
- Kindness and transparency: every automatic decision has a one-line "why?".
- Visual calm: light theme only, one accent colour, motion only for state changes.
- `src/core/` is pure TypeScript: it never imports from `src/lib/`, `src/islands/`, Svelte or
  Astro, and is covered by unit tests that run in Node.
- Works offline, installable as a PWA. Deployed on GitHub Pages under `/vector/`.

## Beyond the plan (approved by Krishna)
- End-to-end encrypted sync on Supabase project `vector` (ADR 0005); backup files merge on import
  (ADR 0004). The CSP allows only that one extra origin (ADR 0006).
- Four MediaPipe models (face, pose, object, hand), served from `public/models` with pinned hashes
  by `scripts/prepare-models.mjs` (ADR 0008). Today JS budget is 70 kB (ADR 0007).
- Open ideas wait in `docs/proposte.md`.

## Commands

- `pnpm dev` — local dev server
- `pnpm check` — typecheck, lint, unit tests, build, JS budget (must be green)
- `pnpm e2e` — Playwright end-to-end and axe accessibility tests
