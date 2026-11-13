# 0009 — I modelli della fotocamera girano in un Web Worker

Data: 2026-11-13 · Stato: accettata

## Contesto
Con quattro modelli sul thread principale la verifica della fotocamera era a scatti: ogni analisi
(e gli stalli della GPU) bloccava il disegno della pagina e del video, e la maglia del viso saltava
6 volte al secondo.

## Decisione
- I modelli girano in un worker modulo (`src/lib/vision.worker.ts`) con la build ES-module del
  WASM di MediaPipe. MediaPipe azzera `self.ModuleFactory` dopo ogni modello e in un worker modulo
  il suo `import()` resta in cache: il worker importa il loader una volta e ripassa la factory
  prima di ogni modello, creandoli uno alla volta.
- La pagina cattura un fotogramma ridotto a 320×240 (`createImageBitmap`) e lo trasferisce senza
  copia; il successivo parte solo quando il worker ha risposto, quindi non si accumula ritardo.
  Ritmo: 6 analisi al secondo in sessione (3 se l'analisi supera 30 ms), fino a 30 con la vista
  dal vivo aperta, dove il video è a 640×480.
- Il viso si analizza a ogni fotogramma; posa ogni 150 ms, mani ogni 300 ms, telefono ogni 600 ms.
- La vista dal vivo disegna a ogni fotogramma dello schermo: i punti scivolano verso l'ultima
  analisi (`glide`) e i numeri sono smussati (`ease`), entrambi in `src/core/focus/geometry.ts`.

## Conseguenze
Misura con webcam finta e tutti i modelli: nessun long task in 10 s, ~54 fps di disegno.
