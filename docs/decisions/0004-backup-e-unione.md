# 0004 — Backup in JSON e unione all'importazione

Data: 2026-11-13 · Stato: accettata

## Contesto
Krishna vuole spostare i dati tra computer e telefono senza mai perdere progressi. Il piano chiede
un backup cifrato con anteprima e conferma (sezione 8).

## Decisione
- L'esportazione produce un file JSON con tutte le tabelle, compresa la sessione in corso. Con una
  frase segreta il file è cifrato sul dispositivo (AES-256-GCM, PBKDF2-SHA256 a 600.000 giri,
  contenuto compresso con gzip); senza frase resta JSON in chiaro.
- Sul telefono il file si condivide con il pannello nativo (Web Share API), altrimenti si scarica.
- L'importazione valida tutto con Zod, mostra un'anteprima e **unisce**, non sostituisce
  (`src/core/backup/merge.ts`): le sessioni si sommano, ogni capitolo tiene il punto più avanzato,
  i traguardi la prima data, le impostazioni più recenti vincono, una sessione già registrata non
  torna in vita. L'unione è idempotente e testata.

## Conseguenze
La stessa funzione di unione serve alla sync (ADR 0005).
