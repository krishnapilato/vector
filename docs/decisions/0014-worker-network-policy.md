# 0014 — Bloccare la telemetria MediaPipe nel worker

Data: 2026-11-13 · Stato: accettata (integra ADR 0006 e 0009)

## Contesto

La CI del primo merge Lite ha rilevato una fetch a `https://odml.pa.googleapis.com/v1/log` durante l’avvio della webcam. MediaPipe include telemetria di utilizzo: servire modello e WASM localmente non basta a eliminarla. La CSP nel documento non impone `connect-src` al worker caricato da URL; su GitHub Pages non possiamo aggiungere un header CSP alla risposta dello script worker.

## Decisione

Prima dell’inizializzazione del modello, il worker installa un wrapper di fetch che consente solo URL HTTP(S) della propria origine. Rifiuta richieste esterne prima di chiamare la fetch nativa e disabilita i redirect per impedire che un URL locale conduca altrove. Le opzioni delle richieste e il caricamento dei modelli locali restano supportati. Non si modifica il pacchetto MediaPipe e non si esclude la telemetria dal test zero-network.

## Verifica e limiti

Unit test verificano stringhe, URL, Request, host/porte/protocolli diversi e redirect disabilitati. Il test browser esistente continua a richiedere zero richieste esterne e webcam attiva. La policy copre le fetch usate dal SDK attuale; non è un sandbox completo per codice arbitrario nel worker. Gli aggiornamenti della dipendenza devono continuare a superare il gate di rete.

Fonte: [MediaPipe Tasks Privacy Notice](https://developers.google.com/edge/mediapipe/solutions/privacy).
