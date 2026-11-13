# 0001 — Ripartenza v3: perché e cosa cambia

Data: 2026-11-13 · Stato: accettata

## Contesto

La v2 (React, quiz, lettore PDF, penna, radio, METAR, glossario, profili, sync, i18n, IA) è
cresciuta oltre ciò che serviva davvero: troppe funzioni, poca costanza d'uso.

## Decisione

- Si riparte da zero seguendo `docs/PIANO-V3.md`. Il codice v2 resta nel tag `v2-final`.
- Vector diventa un compagno di studio per il PPL(A) EASA: pianifica, accompagna blocchi da
  30 minuti, registra in un libretto. Niente quiz, PDF, microfono, IA, profili, sync, traduzioni,
  tema scuro.
- Stack: Astro statico + isole Svelte 5, TypeScript strictest, CSS con token, Dexie, Zod,
  MediaPipe Face Landmarker servito in locale, PWA, Biome, Vitest, Playwright + axe-core.
- Si portano dalla v2 solo i moduli della sezione 13 del piano, ciascuno nella sua fase e con test.
- **Numero di versione**: la prima release della nuova app è **v1.0.0** (decisione di Krishna),
  non v3.0.0. Non esistono tag di versione precedenti. «v3» resta il nome del piano e del ramo di
  integrazione; durante lo sviluppo `package.json` porta `1.0.0-dev`.
- **Rami**: Git non può avere insieme `v3` e `v3/f0-…`, quindi i rami di fase usano il trattino
  (`v3-f0-setup`, `v3-f1-design`, …) e si uniscono su `v3`.
- **Rigore**: TypeScript `strictest`; `astro check`, `svelte-check` e Biome falliscono anche sui
  warning; variabili, import e parametri inutilizzati sono errori.

## Conseguenze

- Meno codice e meno superficie da mantenere; ogni funzione nuova passa da `docs/proposte.md`.
- Chi aveva installato la v2 perde i suoi dati locali al primo aggiornamento (utente unico: Krishna).
