# Vector

A calm study companion for the EASA PPL(A) theory. Vector plans how much to study each month,
week and day, walks you through focused 30-minute blocks, and keeps a logbook of everything you
did. Everything stays in your browser.

Vector is being rebuilt from scratch. The plan is in [docs/PIANO-V3.md](docs/PIANO-V3.md); the
previous version is kept under the `v2-final` tag.

## Development

Requires Node (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev      # http://localhost:4321/vector/
pnpm check    # typecheck, lint, tests, build, budget
pnpm e2e      # end-to-end and accessibility tests
```

Stack: Astro (static), Svelte 5, TypeScript strict, Biome, Vitest, Playwright + axe-core.

## License

MIT, see [LICENSE](LICENSE).
