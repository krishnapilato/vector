# 0013 — Gate di qualità riproducibili, anche per il deploy manuale

Data: 2026-11-13 · Stato: accettata

## Contesto

Un progetto nato per uso personale deve poter evolvere senza compromettere timer, dati locali e privacy. Le promesse del README devono corrispondere a controlli eseguibili. Il deploy manuale precedente poteva evitare la CI.

## Decisione

- `pnpm check` deve superare typecheck strictest, controlli Astro/Svelte senza warning, Biome senza warning, unit test con coverage, preparazione modelli, build e budget JS.
- Conservare soglie del 100% per righe, branch, funzioni e statement in `core/focus` e `core/session`. Non presentarle come copertura globale dell’interfaccia o di tutti gli adapter.
- Il budget della pagina iniziale resta inferiore a 50 kB gzip, includendo i suoi import statici secondo `scripts/check-budget.mjs`. Modello, WASM e import dinamici sono separati: il budget non misura ogni byte che l’app scaricherà nel tempo.
- `pnpm e2e` resta un gate distinto con Chromium desktop e telefono, axe-core, offline e webcam simulata. Le regressioni rilevanti comprendono aggiornamenti concorrenti delle impostazioni, import ripetuto dello stesso file, viewport desktop e accesso alla privacy dallo scudo.
- Il deploy automatico usa il commit della CI riuscita su main. Per `workflow_dispatch` eseguire anche check ed e2e prima della pubblicazione, senza una scorciatoia manuale.
- Screenshot generati dalla build, in un browser con storage isolato e dati dimostrativi espliciti, tramite `pnpm docs:screenshots`.

## Conseguenze e limiti

Il deploy manuale richiede più tempo e Chromium, ma rispetta gli stessi gate. La branch protection è una configurazione GitHub separata: il workflow da solo non rende obbligatori i check per il merge. Copertura, contrasto e axe non provano l’assenza di ogni bug né la qualità delle stime della webcam: servono revisione e prove con dispositivi reali. I gate non vengono abbassati per accomodare una modifica visiva.
