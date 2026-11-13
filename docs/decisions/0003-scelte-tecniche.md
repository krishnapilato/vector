# 0003 — Scelte tecniche minori della ricostruzione

Data: 2026-11-13 · Stato: accettata

Scelte lasciate aperte dal piano, risolte con l'opzione più semplice (sezione 0, regola 5).

- **Versioni**: `pnpm-workspace.yaml` rifiuta pacchetti pubblicati da meno di 3 giorni; si fissa
  la versione più recente oltre quella soglia. TypeScript 6 (non 7) perché `astro check` e
  `svelte-check` non supportano ancora la 7.
- **Rigore**: preset `strictest` di Astro; `astro check`, `svelte-check` e Biome falliscono anche
  sui warning; `useLiteralKeys` di Biome è spento perché contrasta con
  `noPropertyAccessFromIndexSignature` di TypeScript. Il Markdown è escluso da Biome.
- **Isole**: ogni schermata è una pagina Astro statica con un'isola `client:only="svelte"` e un
  testo di caricamento immediato; i dati vivono in IndexedDB e la vista segue il database con
  `liveQuery` di Dexie (`src/lib/live.svelte.ts`, valori non reattivi in profondità per poterli
  riscrivere nel database così come sono).
- **Motivi del piano come dati**: il «perché?» di ogni blocco è salvato come codice strutturato
  (`Reason`) e tradotto in frase da `src/lib/copy.ts`, perché `src/core` non può importare da `lib`.
- **Sessione in corso**: tabella `active` (una riga) oltre a quelle della sezione 8, perché il
  timer deve sopravvivere alla chiusura del browser e passare da un dispositivo all'altro.
- **Calibrazione**: salva anche la chiusura media delle palpebre durante la lettura (guardare il
  libro abbassa le palpebre) per evitare falsi «occhi chiusi».
- **Test e2e**: un piccolo server statico (`scripts/serve-dist.mjs`) invece di `astro preview`,
  che ammette una sola istanza alla volta; Chromium con webcam finta per la fotocamera.
- **Modelli**: scaricati dal bucket ufficiale MediaPipe con hash fissati, mai inclusi in Git; il
  service worker li mette in cache al primo uso (CacheFirst) invece che in precache, perché il
  plugin PWA non accetta file oltre il suo limite di dimensione.
