# 0007 — Budget di JS della pagina Oggi: 70 kB invece di 60

Data: 2026-11-13 · Stato: proposta, in attesa di Krishna

## Contesto
Il piano (sezione 12) fissa la pagina Oggi sotto i 60 kB gzip di JS. Misura reale dopo
l'ottimizzazione (operazioni del pianificatore e scheda dei traguardi caricate dopo il primo
disegno, registrazione del service worker senza libreria):

| Parte | kB gzip |
|---|---|
| Dexie (imposto dal piano) | 31,4 |
| Runtime Svelte 5 (imposto dal piano) | 19,0 |
| `src/lib/copy.ts` (tutti i testi, file unico per la sezione 10) | ~7 |
| Isola Oggi e componenti | ~7 |
| Altro (date, navigazione, eventi) | ~1 |
| **Totale** | **65,3** |

Le sole librerie richieste dal piano pesano 50 kB. I testi crescono con ogni funzione (sync,
verifica della fotocamera, segnali extra) e il file unico viene caricato per intero.

## Decisione
Budget a 70 kB, controllato da `scripts/check-budget.mjs` in `pnpm check`, con margine per i testi.
Si conta il JS caricato in modo statico; i moduli caricati subito dopo il primo disegno
(`today-ops.ts`, scheda traguardi) no.

## Alternativa
Tornare a 60 kB dividendo i testi per schermata in `src/lib/copy/` (Oggi caricherebbe solo i suoi).
