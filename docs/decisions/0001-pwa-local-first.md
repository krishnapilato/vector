# 0001 — PWA local-first, prima su computer

**Contesto.** L'app deve funzionare su Windows oggi e su telefono domani, senza Mac, senza store e a costo zero. I dati di studio sono personali.

**Alternative.** App nativa (serve un Mac per iOS); Electron o Tauri (un'app per piattaforma); web app con server e database.

**Decisione.** Una PWA con i dati in IndexedDB sul dispositivo. La v1.0 è per computer, perché la parte più complessa (fotocamera, microfono, modalità focus) va costruita e testata su una sola piattaforma; il telefono arriva in v1.2.

**Conseguenze.** Un solo codice; nessun server applicativo; serve una sincronizzazione cifrata per usare più dispositivi.
