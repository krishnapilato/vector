# 0012 — Vector Studio: accento nero fumo e workspace compatto

Data: 2026-11-13 · Stato: accettata

## Contesto

Il rinnovo deve rendere coerenti Focus, Logbook e Settings mantenendo il peso iniziale sotto il budget. Le richieste di prodotto sostituiscono la precedente direzione visiva del piano: niente fascia superiore ripetitiva, sidebar larga, suggerimenti recenti o numerazione decorativa della sessione.

## Decisione

- Token semantici CSS come unica base per colori, tipo, spazio, forma e movimento. Accento nero fumo, superfici neutre; verde e ambra restano esclusivamente colori di stato. Instrument Sans e cifre tabulari restano come in ADR 0011.
- Riutilizzare Astro e Svelte con componenti nativi. Nessuna nuova dipendenza UI: il cambiamento richiede soprattutto CSS e semantica HTML.
- Desktop: barra di 80 px con sole icone, nomi accessibili e tooltip su hover/focus; contenitore alto un viewport, area principale scorrevole quando necessario. Mobile/tablet: dock inferiore e scorrimento naturale.
- Una sola headline per pagina, senza barra superiore. Lo scudo apre direttamente la sezione Privacy nelle impostazioni. Eliminare etichette decorative e suggerimenti di attività recenti dalla card Focus.
- Skeleton riutilizzabile con annuncio dello stato agli screen reader e animazione disattivata con reduced motion.
- Import backup: input file nativo, visivamente integrato in un pulsante, focus visibile, nome del file annunciato e possibilità di selezionare nuovamente lo stesso file dopo un errore.
- Logbook: statistiche visibili anche senza sessioni, stato vuoto con invito ad avviare una sessione, cronologia con durata e chiarezza, ricerca su attività/note, conteggio risultati e azione per azzerare il filtro. Nessuna metrica inventata quando la webcam non è stata usata.
- Le richieste camera asincrone vengono invalidate quando si salta la calibrazione, si termina una sessione o si cambia sezione. Una risposta tardiva arresta il proprio handle invece di sostituire quello corrente. Gli aggiornamenti delle impostazioni sono transazionali per evitare la perdita di modifiche concorrenti.

## Conseguenze e verifica

Il layout si adatta anche a viewport bassi tramite scorrimento interno: non si riducono i target per far entrare tutto. La barra a icone richiede tooltip e nomi accessibili per restare comprensibile. I test di contrasto, axe, navigazione, importazione ripetuta e assenza di overflow verificano i vincoli; gli screenshot riproducibili in `docs/screenshots` documentano il risultato reale. Il controllo automatico non sostituisce la revisione visiva.
