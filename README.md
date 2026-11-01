# Vector

Studia i concetti, non le risposte.

Vector è una web app di studio **local-first**, open source e gratuita. Nasce per preparare la teoria del PPL(A) EASA, ma è costruita per qualsiasi esame. Obiettivo: capire davvero, non memorizzare le risposte dei quiz.

> Stato: **v0.1 — fondamenta**. Stack, qualità e CI pronti; le funzioni arrivano versione per versione (vedi la roadmap nel documento di progetto).

## Principi

- **Privacy prima di tutto**: i dati restano sul dispositivo. Fotocamera e microfono, quando arriveranno, sono analizzati in locale e mai registrati.
- **Zero distrazioni**: bianco, nero e tre grigi; nessuna animazione (verificato da un test).
- **Niente psicologia manipolativa**: niente streak, badge o punti.
- **Comprensione, non memoria**: il sistema di quiz è progettato per impedire lo studio a memoria.

## Stack

React 19 + React Compiler · Vite 8 · TypeScript 7 (`strict`) · Tailwind CSS 4 · Zod · PWA (vite-plugin-pwa) · Biome · Vitest 5 (unit + browser) · Playwright + axe-core · GitHub Actions.

## Struttura

```
src/
  core/      logica pura, senza React né browser (testata in millisecondi)
  config/    configurazione JSON validata con Zod
  app/       interfaccia React
  styles/    token di design e regola "zero animazioni"
e2e/         test end-to-end Playwright
docs/decisions/  registro delle decisioni architetturali
```

Regola: tutto ciò che non è interfaccia vive in `src/core` ed è indipendente dal framework.

## Comandi

Richiede Node.js ≥ 24 (consigliato 26 LTS, vedi `.nvmrc`) e pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev            # sviluppo
pnpm check          # typecheck, lint, test, build, budget di peso
pnpm test:browser   # test dei componenti in Chromium
pnpm e2e            # test end-to-end (prima volta: pnpm exec playwright install chromium)
```

## Qualità

La CI blocca ogni modifica che non passa: controllo dei tipi, lint, test unitari con copertura minima, test nel browser, test end-to-end (incluse accessibilità e assenza di animazioni) e budget di peso del bundle iniziale (120 kB gzip).

## Come è stato costruito

Progettato e diretto da Krishna Pilato; sviluppato con l'aiuto di Claude. Architettura, scelte tecniche e revisione del codice sono mie: le motivazioni sono in `docs/decisions/`.
