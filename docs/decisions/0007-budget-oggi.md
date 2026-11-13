# 0007 — Budget di JS della pagina Oggi: 65 kB invece di 60

Data: 2026-11-13 · Stato: proposta, in attesa di Krishna

## Contesto
Il piano (sezione 12) fissa la pagina Oggi sotto i 60 kB gzip di JS. Misura reale dopo
l'ottimizzazione (operazioni del pianificatore caricate dopo il primo disegno, registrazione del
service worker senza libreria):

| Parte | kB gzip |
|---|---|
| Dexie (imposto dal piano) | 31,4 |
| Runtime Svelte 5 (imposto dal piano) | 19,0 |
| `src/lib/copy.ts` (tutti i testi, file unico per la sezione 10) | 6,3 |
| Isola Oggi e componenti | 7,2 |
| Altro (date, navigazione, eventi) | 1,0 |
| **Totale** | **64,9** |

Le sole librerie richieste dal piano pesano 50 kB. Scendere a 60 richiederebbe di dividere
`copy.ts` in più file, contro la regola del file unico.

## Decisione
Budget a 65 kB, controllato da `scripts/check-budget.mjs` in `pnpm check`. Si conta solo il JS
caricato in modo statico; le operazioni caricate subito dopo il primo disegno (`today-ops.ts`) no.

## Conseguenze
Se Krishna preferisce 60 kB, l'alternativa è dividere i testi per schermata in `src/lib/copy/`.
