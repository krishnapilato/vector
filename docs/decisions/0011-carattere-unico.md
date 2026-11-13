# 0011 — Un solo carattere: Instrument Sans

Data: 2026-11-13 · Stato: accettata (sostituisce la tipografia di PIANO-V3-LITE §6)

## Contesto
Il piano indicava IBM Plex Sans per il testo e IBM Plex Mono per i numeri. Nel rinnovo del design
(anello del timer, dock su telefono, numeri grandi nel Logbook) Krishna ha approvato un carattere
più moderno e unico. Il requisito del piano resta: numeri tabulari, alta leggibilità, servito
dall'app.

## Decisione
- `@fontsource-variable/instrument-sans` 5.3.0, file variabile `wght` 400–700 (latin ~29 kB,
  latin-ext solo se serve): un file al posto dei cinque di Plex.
- Le cifre tabulari (`font-variant-numeric: tabular-nums`, già sul `body`) sono verificate in
  Chromium: con `tnum` "1111" e "0000" hanno la stessa larghezza. Niente più monospazio per timer
  e statistiche.
- `--font-mono` resta il monospazio di sistema, solo per gli esempi di codice in `/style`: nessun
  download.

## Conseguenze
Meno byte e un solo stile da mantenere. `font-src 'self'` non cambia. Se un giorno servisse un
altro carattere, deve avere cifre tabulari e stare in un pacchetto `@fontsource` con versione fissa.
