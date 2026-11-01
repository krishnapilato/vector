# Vector

Studia i concetti, non le risposte.

Vector è una web app di studio **local-first**, open source e gratuita. Nasce per preparare la teoria del PPL(A) EASA, ma è costruita per qualsiasi esame. Obiettivo: capire davvero, non memorizzare le risposte dei quiz.

> Stato: **v1.0 — libreria, lettore, concentrazione e profilo**. Importi i tuoi libri, li leggi e li sottolinei, generi domande di comprensione e studi con un monitoraggio dell'attenzione che resta sul tuo computer.

## Cosa fa già

- **Sessioni di studio** con ripasso spaziato (FSRS): prima i concetti da ripassare, poi pochi nuovi, mescolati tra le materie.
- **Anti-memorizzazione**: si ripassa il concetto, non la domanda (più formulazioni per concetto), risposte rimescolate e distrattori sempre diversi, calcoli con numeri nuovi a ogni giro, pausa per pensare prima di vedere le opzioni, livello di sicurezza (sicuro / incerto / a caso), domanda «Perché?», rilevamento delle risposte troppo rapide su domande già viste.
- **Errore → si torna al testo**: dopo un errore compare il paragrafo di riferimento e il concetto torna più avanti con parole diverse.
- **Due punteggi onesti**: comprensione (domande mai viste) e riconoscimento (domande già viste).
- **Timer per tipo di domanda**; un tempo scaduto vale «non lo so». Pausa automatica se esci dall'app.
- **Ripresa esatta** della sessione dopo una chiusura.
- **Materie** con lo stato di ogni concetto e il testo da rileggere.
- **Piano**: data dell'esame con conto alla rovescia e concetti nuovi al giorno consigliati, calendario settimanale delle sessioni (anche ripetute ogni settimana), export `.ics` per Google Calendar.
- **Pomodoro** che continua su ogni schermata: tempo nascosto (si mostra per 2 secondi su richiesta), suono breve e notifica a fine fase, minuti di concentrazione registrati.
- **Strumenti di volo**, offline: calcolatrice (in gradi, senza `eval`), conversioni, triangolo del vento e componenti per la pista, quota pressione / ISA / quota densità / TAS, tempo-distanza-velocità, carburante, peso e centraggio. Si aprono anche **durante lo studio** in un pannello laterale, senza uscire dalla sessione.
- **Impostazioni**: modalità Capire / Allenamento, lunghezza della sessione, timer, chiave Gemini facoltativa, backup e cancellazione dei dati.
- **Spiegamelo in un altro modo** (facoltativo): con la propria chiave Gemini, una spiegazione alternativa dopo un errore.
- **Libreria**: importa PDF, testo o Markdown (manuali FAA di pubblico dominio, regolamenti EASA ed EUR-Lex, i tuoi appunti). Capitoli dall'indice del PDF, affidabilità della fonte, avanzamento della lettura. Link diretti alle fonti ufficiali gratuite.
- **Lettore**: vista testo (dimensione regolabile) o pagina originale del PDF, indice, ricerca in tutto il libro, evidenziatore e note **solo manuali**, frecce per sfogliare, glossario italiano-inglese con doppio clic e spiegazione del termine nella frase (IA, facoltativa).
- **Crea domande dal libro**: con la propria chiave Gemini, dalle pagine scelte nascono concetti con più formulazioni, distrattori, «Perché?» e punti chiave. Si controllano e approvano prima di entrare nel corso; ogni concetto mostra da dove viene e si può eliminare.
- **Concentrazione**: l'uscita dall'app è sempre contata. Facoltativi fotocamera (assenza, sguardo altrove, telefono in mano, occhi chiusi) e microfono (c'è una voce? è la tua?). Analisi in memoria sul dispositivo, nessuna immagine o audio salvati o inviati. Distrazioni brevi ignorate, pausa automatica se sei lontano troppo a lungo, punteggio di attenzione per sessione.
- **Cosa so di te**: una pagina con tutto ciò che Vector ha dedotto dalle tue risposte (materie e tipi di domanda più difficili, risposte riconosciute o indovinate, orari migliori, attenzione, termini cercati) e le note neutre che adattano le spiegazioni dell'IA. Si cancella con un clic.
- Tastiera: `1`–`4` rispondi, `0` non lo so, `Spazio`/`Invio` avanti, `Esc` esci.

## Principi

- **Privacy prima di tutto**: i dati restano sul dispositivo. La chiave AI è dell'utente e non lascia il suo browser. Fotocamera e microfono sono analizzati in locale e mai registrati.
- **Zero distrazioni**: bianco, nero e tre grigi; nessuna animazione (verificato da un test).
- **Niente psicologia manipolativa**: niente streak, badge o punti.
- **Comprensione, non memoria**: il sistema di quiz è progettato per impedire lo studio a memoria.

## Stack

React 19 + React Compiler · Vite 8 · TypeScript 7 (`strict`) · Tailwind CSS 4 · Zod · PWA (vite-plugin-pwa) · Biome · Vitest 5 (unit + browser) · Playwright + axe-core · GitHub Actions.

## Struttura

```
src/
  core/      logica pura, senza React né browser (testata in millisecondi)
  config/    configurazione JSON validata con Zod
  app/       interfaccia React
  styles/    token di design e regola "zero animazioni"
e2e/         test end-to-end Playwright
docs/decisions/  registro delle decisioni architetturali
```

Regola: tutto ciò che non è interfaccia vive in `src/core` ed è indipendente dal framework.

## Comandi

Richiede Node.js ≥ 24 (consigliato 26 LTS, vedi `.nvmrc`) e pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev            # sviluppo
pnpm check          # typecheck, lint, test, build, budget di peso
pnpm test:browser   # test dei componenti in Chromium
pnpm e2e            # test end-to-end (prima volta: pnpm exec playwright install chromium)
```

## Rilascio

- **CI** (`ci.yml`) a ogni push e pull request.
- **GitHub Pages** (`pages.yml`): dopo una CI verde su `main` l'app viene pubblicata. Da attivare una volta in Settings → Pages → Source: GitHub Actions.
- **Release** (`release.yml`): con un tag `vX.Y.Z` uguale alla versione in `package.json` viene creata una release con lo zip della build.

## Qualità

La CI blocca ogni modifica che non passa: controllo dei tipi, lint, test unitari con copertura minima, test nel browser, test end-to-end (incluse accessibilità e assenza di animazioni) e budget di peso del bundle iniziale (135 kB gzip).

## Come è stato costruito

Progettato e diretto da Krishna Pilato; sviluppato con l'aiuto di Claude. Architettura, scelte tecniche e revisione del codice sono mie: le motivazioni sono in `docs/decisions/`.
