# 0007 — Sincronizzazione cifrata end-to-end, server dell'utente

**Stato:** accettata (v1.2)

## Contesto

Studio al computer e ripasso sul telefono: i progressi devono seguire l'utente. Ma Vector è
local-first e privacy-first: nessun account, nessun server nostro che veda i dati.

## Decisione

- Tutto viene cifrato **sul dispositivo** (AES-GCM 256; chiave da PBKDF2-SHA256, 600.000
  iterazioni, sale casuale a ogni cifratura) con una frase segreta che non lascia il dispositivo.
- Dalla stessa frase si derivano, con sali diversi, un identificativo e un token di accesso:
  un secondo dispositivo con la stessa frase trova gli stessi dati, senza account.
- Il server è un Cloudflare Worker che l'utente pubblica sul proprio account (`worker/`). Conserva
  blocchi opachi con un numero di versione; rifiuta dati non cifrati e scritture basate su una
  versione vecchia (`409`), così un dispositivo indietro non sovrascrive quello più avanti.
- Strategia semplice e prevedibile: «Invia» e «Ricevi» espliciti, ricevere sostituisce i dati
  locali. Niente fusione automatica, che con dati di studio darebbe risultati sorprendenti.
- Il testo dei libri non viaggia: è pesante e spesso coperto da copyright. Si ricollega il PDF.
- Lo stesso formato cifrato vale per i backup su file, utili anche senza server.

## Conseguenze

- Se la frase si perde, i dati sul server sono irrecuperabili: è detto chiaramente.
- La logica del server vive in `src/core/sync/server.ts` ed è testata come il resto del core;
  il Worker è solo un adattatore.
