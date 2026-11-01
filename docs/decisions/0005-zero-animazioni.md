# 0005 — Zero animazioni come regola verificata

**Contesto.** Le animazioni attirano l'attenzione: in un'app che vuole ridurre le distrazioni sono rumore.

**Decisione.** Una regola CSS globale disattiva `animation` e `transition`; Biome vieta le librerie di animazione; un test end-to-end fallisce se un elemento della pagina ha un'animazione o una transizione attiva.

**Conseguenze.** Nessuna animazione può entrare per errore, nemmeno con un aggiornamento di una dipendenza.
