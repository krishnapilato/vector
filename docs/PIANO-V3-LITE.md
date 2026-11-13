# Vector v3 Lite — Piano di costruzione (Focus-First PWA)

> Documento di riferimento per costruire Vector v3 Lite da zero con Claude Code.
> Autore e responsabile delle decisioni: Krishna Pilato. Redatto il 13 novembre 2026.
> Lingua dell'interfaccia: **solo inglese** (nessuna traduzione, nessuna libreria i18n). Lingua del codice e dei commenti: inglese.
> Tema: **solo chiaro** (nessun tema scuro, nessuna impostazione del tema).

---

## 0. Come usare questo documento (istruzioni per Claude Code)

1. Leggi tutto il documento prima di scrivere codice.
2. Lavora **una fase alla volta** (sezione 9), nell'ordine indicato. Una fase è finita solo quando tutti i criteri di accettazione passano e `pnpm check` è verde.
3. Alle fasi segnate **⛔ CANCELLO** fermati e chiedi a Krishna di provare e approvare prima di proseguire.
4. **Non aggiungere funzioni che non sono in questo documento.** La v2 e il primo piano v3 erano troppo complessi: ogni riga di codice non strettamente necessaria al focus attivo e alla privacy va evitata.
5. Quando una scelta tecnica non è decisa qui, scegli la soluzione più semplice e registrala come ADR breve in `docs/decisions/`.
6. Prima di usare una libreria verifica la documentazione aggiornata. Usa sempre l'ultima versione stabile e fissa le versioni nel lockfile (`pnpm-lock.yaml`).
7. Tutti i testi dell'interfaccia seguono il tono della sezione 6.
8. Commit piccoli e descrittivi, in inglese. Un ramo per fase (`v3/f1-design`, …), unito su `v3` quando la fase è chiusa.

---

## 1. Visione e Posizionamento

**Vector è una PWA open-source, privacy-first, per sessioni di studio e deep work ad alta concentrazione.**

Non sostituisce il calendario (Google Calendar, Apple Calendar) né gli appunti o i quiz (Notion, quizppl.it). Fa **una cosa sola, al massimo livello ingegneristico**: accompagna blocchi di lavoro/studio attivo usando la webcam **esclusivamente in locale** (via MediaPipe Face Landmarker) per rilevare cali di attenzione e affaticamento visivo/posturale, suggerendo pause al momento giusto e registrando un logbook essenziale.

### Frase guida
«Open Vector, press Start, focus well. Everything stays on your device.»

### Cosa NON è (fuori ambito)
- Nessun planner settimanale/mensile, nessun algoritmo di spaced repetition, nessun export `.ics`.
- Nessun catalogo di libri, capitoli, quiz o materiali specifici.
- Nessun onboarding multi-step: l'app è utilizzabile al primo secondo.
- Nessun microfono, nessuna IA/LLM, nessun server/backend, nessun account.
- Nessuna gamification (no streak, no punti, no classifiche, no notifiche colpevolizzanti).
- Nessun tema scuro, nessuna internazionalizzazione.

---

## 2. Principi (vincolanti)

1. **Privacy per costruzione (Zero-Network Inference).** Tutti i dati restano nel browser (IndexedDB). I fotogrammi della fotocamera vengono analizzati in memoria e scartati immediatamente: nessuna immagine viene salvata, registrata o inviata. I modelli MediaPipe (`.task` e `.wasm`) sono serviti localmente dall'app stessa e messi in cache dal Service Worker. Zero richieste di rete durante le sessioni.
2. **Zero attrito.** Avviare una sessione richiede **1 tocco** dalla schermata principale. Chiuderla richiede **al massimo 10 secondi**.
3. **General-purpose e universale.** Nessun vincolo di dominio: funziona allo stesso modo per chi studia sul libro cartaceo, chi programma o chi prepara un esame.
4. **Gentilezza e trasparenza.** L'app non giudica mai. Ogni suggerimento di pausa ha un pulsante «Why?» che spiega in una riga quali segnali lo hanno attivato.
5. **Calma visiva.** Tema chiaro unico (illumina naturalmente il viso la sera migliorando il tracking), tipografia ad alta leggibilità, numeri tabulari.
6. **Logica pura isolata (`src/core/`).** Tutto ciò che non è UI o I/O vive in TypeScript puro (`strict`), zero dipendenze da browser/DOM/Svelte, testato al 100% con Vitest.
7. **Offline-first PWA.** Installabile su desktop e mobile, funzionante in modalità aereo.

---

## 3. Mappa delle schermate (3 rotte + stile)

Navigazione minimale (in alto o in basso): **Focus · Logbook · Settings**.

| Rotta | Etichetta UI | Scopo |
|---|---|---|
| `/` | **Focus** | Schermata unica per avviare, vivere e chiudere la sessione. |
| `/logbook` | **Logbook** | Storico delle sessioni con totali, filtri per tag ed export CSV/JSON. |
| `/settings` | **Settings** | Durata default, fotocamera, calibrazione postazione, backup cifrato, pagina Privacy, reset dati. |
| `/style` | **Style Guide** | Pagina interna del design system (non in navigazione). |

---

## 4. Funzioni nel dettaglio

### 4.1 Focus (`/`) — Stati della schermata
La schermata principale gestisce tre stati fluidi senza cambiare pagina (o con transizione istantanea):

#### A. Pronto (Idle)
- Campo testo opzionale, rapido: *"What are you working on?"* (es. `Trebbi Ch. 4`, `Deep Work`, `Math`) con suggerimenti dagli ultimi tag usati.
- Selettore rapido durata: `25m` · `30m` (default) · `45m` · `60m` (o modalità *Open / Stopwatch*).
- Selettore modalità: **Camera ON** (desk) vs **Camera OFF** (on the go / audio-only).
- Pulsante primario grande: **Start**.
- Se la fotocamera è attiva e non esiste ancora una calibrazione per la postazione corrente: avvio automatico della **calibrazione rapida di 15 secondi** prima del timer (saltabile o ripetibile).

#### B. In corso (Active Session)
- **Timer basato su timestamp** (`Date.now()` / `performance.now()`): sopravvive a ricarica della pagina o sospensione del browser.
- Il conto alla rovescia è **nascosto di default** (mostra solo una barra di avanzamento sottile e calmissima) e appare per 3 secondi toccando l'area centrale (opzione in Settings per tenerlo sempre visibile).
- Indicatore discreto in alto: punto di stato + testo chiaro (`Camera active · Local only`).
- Stato rilevato in tempo reale in una parola neutra: `Focused` · `Away` · `Break suggested`.
- Banner non invasivo quando scatta la soglia di affaticamento: *"Take 5 minutes to rest your eyes?"* con azioni **Take break**, **Keep going**, e **Why?**.
- Controlli essenziali: **Pause / Resume** e **End**.
- Uscita dalla scheda (`visibilitychange`): dopo 60 secondi con scheda nascosta (in modalità Camera ON), il timer va in pausa automatica e registra la pausa.

#### C. Chiusura (Wrap-up — max 10 secondi)
Alla fine del timer o premendo **End**:
- Riepilogo istantaneo: *"30 active min · 86% focus"*.
- **Clarity / Energy rating (1–5)**: cinque pulsanti grandi per valutare com'è andata la sessione.
- **Nota opzionale** in una riga (es. *"Stopped at page 124"*).
- Pulsante **Save to logbook** (salva in IndexedDB e torna a *Pronto*).

### 4.2 Logbook (`/logbook`)
- Riepilogo in alto: **Ore totali**, **Ore questa settimana**, **Media attenzione %**.
- Elenco cronologico delle sessioni: data, tag/titolo, durata attiva, % attenzione, indice stanchezza, valutazione 1–5, nota.
- Filtro rapido per tag/parola chiave.
- Pulsante **Export CSV** (per analisi esterne o backup leggero).

### 4.3 Settings (`/settings`)
- **Sessione**: durata predefinita, mostra sempre il timer (on/off), suoni discreti di fine blocco (on/off).
- **Fotocamera e Rilevamento**: attiva/disattiva di default, sensibilità (`Low` / `Normal` / `High`), pulsante **Calibrate posture (15s)** per creare/aggiornare profili postazione (es. *Desk*, *Laptop*).
- **Dati e Backup**: esporta/importa backup completo JSON (cifrato con passphrase opzionale via Web Crypto API), pulsante **Delete all data** con doppia conferma.
- **Privacy & Security Manifesto**: spiegazione chiara e verificabile di come funziona l'elaborazione locale.

---

## 5. Modulo concentrazione (`src/core/focus/` + `src/lib/camera.ts`)

### 5.1 Tecnologia e Vincoli
- Libreria: `@mediapipe/tasks-vision`, modello **Face Landmarker** (`runningMode: 'VIDEO'`, `numFaces: 1`, `outputFaceBlendshapes: true`, `outputFacialTransformationMatrixes: true`).
- Asset locali in `public/models/`: `face_landmarker.task` e i file WASM di MediaPipe, precachati dal Service Worker. Zero dipendenze CDN a runtime.
- Risoluzione acquisizione webcam: `320×240` a **6 fps** (1 frame ogni ~166 ms), solo mentre la sessione è attiva e la tab è visibile.
- Caricamento dinamico (*lazy import*): MediaPipe e il modello vengono caricati **solo** quando l'utente avvia una sessione con fotocamera attiva, mantenendo il bundle iniziale sotto i **50 kB gzip**.

### 5.2 Pipeline dei segnali (in memoria, mai persistiti)
Per ogni frame viene estratto un oggetto `FrameSample`:
- `timestamp`: number
- `facePresent`: boolean
- `yaw`, `pitch`, `roll`: gradi estratti dalla matrice di trasformazione facciale
- `eyeClosedScore`: media di `eyeBlinkLeft` e `eyeBlinkRight` (blendshapes `0..1`)
- `jawOpenScore`: `jawOpen` (blendshape `0..1`)

### 5.3 Calibrazione postazione (15 secondi)
- L'utente guarda il proprio piano di lavoro naturale (schermo o libro sulla scrivania) per 15 secondi.
- Si calcolano media ($\mu$) e deviazione standard ($\sigma$) di `yaw` e `pitch`.
- Questo evita falsi positivi quando l'utente tiene la testa inclinata in basso per leggere o scrivere su carta.

### 5.4 Metriche derivate (finestra mobile di 60 secondi)
- **Absence**: secondi consecutivi con `facePresent === false`.
- **Off-task gaze**: testa fuori dal cono calibrato: $|\Delta\text{yaw}| > \max(25^\circ, 3\sigma_{\text{yaw}})$ oppure $|\Delta\text{pitch}| > \max(22^\circ, 3\sigma_{\text{pitch}})$.
- **PERCLOS** (*Percentage of Eyelid Closure*): percentuale di tempo nella finestra in cui `eyeClosedScore > 0.55`.
- **Prolonged eye closure**: occhi chiusi continuativamente per $> 1.5\text{ s}$.
- **Yawn count**: eventi in cui `jawOpenScore > 0.60` per $> 1.5\text{ s}$ negli ultimi 10 minuti.
- **Head restlessness**: varianza angolare rapida rispetto alla baseline calibrata.

### 5.5 Macchina a stati e regole
| Stato | Condizione | Azione UI |
|---|---|---|
| `focused` | Segnali nella norma | Nessuna interferenza |
| `micro-distraction` | Segnale fuori soglia $< 8\text{ s}$ | Ignorato (es. bere acqua, prendere appunti) |
| `distracted` | Sguardo/testa fuori soglia $\ge 8\text{ s}$ | Stato cambia in `Away`, conteggiato nel calcolo attenzione |
| `absent` | Nessun viso per $\ge 60\text{ s}$ | Pausa automatica del timer (`Paused · Away`) |
| `fatigued` | PERCLOS alto, oppure $\ge 3$ sbadigli in 10 min, oppure irrequietezza marcata | Proposta gentile di pausa di 5 min |

- **Cooldown proposte**: dopo una proposta di pausa (accettata o ignorata), nessuna nuova proposta per almeno **8 minuti**. Se rifiutata 2 volte nella stessa sessione, la sensibilità scende automaticamente di un livello per quella sessione.
- **Dati salvati in IndexedDB a fine sessione**: solo aggregati numerici (`activeSeconds`, `focusedSeconds`, `distractedSeconds`, `awaySeconds`, `distractionCount`, `fatigueEvents`, `breaksSuggested`, `breaksAccepted`, `focusScorePct`).

---

## 6. Tono di voce e Design System

### 6.1 Tono di voce (`src/lib/copy.ts`)
- Inglese diretto, sobrio, non giudicante.
- Tutte le stringhe UI centralizzate in `src/lib/copy.ts` per coerenza assoluta.
- Esempi:
  - *"Ready when you are."*
  - *"Camera active · Processed locally."*
  - *"You've been rubbing your eyes or yawning a bit. Take 5 minutes?"*
  - *"Why? 3 yawns and heavy eyelids in the last 10 minutes."*
  - *"Away for 60s — timer paused automatically."*
  - *"30 active minutes · 88% focus."*
- Vietati: punti esclamativi eccessivi, parole negative (`failed`, `lazy`, `overdue`, `streak lost`), colori rossi per le metriche di attenzione.

### 6.2 Design System (`src/styles/tokens.css`)
- **Tema chiaro unico** (`color-scheme: light`): sfondo carta calda/bianco sporco (`oklch(0.985 0.004 85)`), superfici pulite, testo ad alto contrasto (`oklch(0.20 0.01 250)`), un solo colore d'accento primario (blu aviazione/profondo `oklch(0.48 0.14 250)`), stato successo (salvia) e stato avviso (ambra morbida).
- **Tipografia locale** (`@fontsource`): `IBM Plex Sans` per l'interfaccia, `IBM Plex Mono` con `font-variant-numeric: tabular-nums` per timer e statistiche.
- **Accessibilità**: contrasto WCAG AA verificato da test, target touch $\ge 44\text{ px}$, navigazione completa da tastiera, zero animazioni con `prefers-reduced-motion: reduce`.

---

## 7. Modello Dati (`src/core/model/` + `src/lib/db.ts`)

IndexedDB gestito con **Dexie**, schemi validati a runtime con **Zod**. Solo **3 tabelle**:

1. **`settings`** (singleton `id: 'default'`):
   - `defaultDurationMin`: number (default `30`)
   - `alwaysShowTimer`: boolean (default `false`)
   - `soundEnabled`: boolean (default `true`)
   - `cameraEnabledByDefault`: boolean (default `true`)
   - `sensitivity`: `'low' | 'normal' | 'high'` (default `'normal'`)
   - `activeCalibrationId`: string | null
2. **`calibrations`**:
   - `id`: string, `label`: string (es. `"Desk"`), `meanYaw`: number, `sdYaw`: number, `meanPitch`: number, `sdPitch`: number, `createdAt`: number
3. **`sessions`**:
   - `id`: string, `tag`: string, `startedAt`: number, `endedAt`: number, `activeSeconds`: number, `pauseCount`: number, `cameraUsed`: boolean, `focusAggregates`: FocusAggregates | null, `clarityRating`: `1 | 2 | 3 | 4 | 5`, `note`: string

Richiesta di `navigator.storage.persist()` al primo salvataggio per proteggere i dati dalla pulizia automatica del browser.

---

## 8. Architettura, Stack e Qualità

- **Framework**: Astro (output statico) + **Svelte 5** (runes) per le isole interattive.
- **Linguaggio**: TypeScript in modalità `strict` (`noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
- **Styling**: CSS nativo con Custom Properties (`tokens.css`) e stili scoped di Svelte (zero framework CSS esterni).
- **Storage & Validazione**: `dexie` + `zod`.
- **Vision**: `@mediapipe/tasks-vision` (asset self-hosted in `public/models/`).
- **PWA**: `@vite-pwa/astro` con precaching completo (inclusi `.task` e `.wasm`).
- **Tooling & CI**:
  - `biome` (linting e formatting ultraveloce).
  - `vitest` (test unitari su tutto `src/core/`).
  - `playwright` + `@axe-core/playwright` (test e2e, verifica zero richieste di rete durante sessione camera, verifica offline/modalità aereo, audit accessibilità).
  - Script unico `pnpm check`: `biome check . && astro check && tsc --noEmit && vitest run && astro build`.

### Struttura del repository
```text
src/
  core/              # 100% Pure TypeScript (zero DOM, zero browser API)
    focus/           # Calibrazione, finestra mobile, PERCLOS, sbadigli, macchina a stati
    session/         # Timer deterministico basato su timestamp e gestione pause
    model/           # Tipi e schemi Zod (Session, Calibration, Settings)
    export/          # Generazione CSV e validazione JSON backup
  lib/               # Adattatori Browser I/O
    db.ts            # Dexie database e migrazioni
    camera.ts        # Wrapper MediaPipe Face Landmarker + getUserMedia
    crypto.ts        # Cifratura AES-GCM (Web Crypto API) per export/import backup
    sound.ts         # Web Audio API per suono gentile fine sessione
    copy.ts          # Tutte le stringhe UI
  components/        # Componenti Svelte atomici del Design System
  islands/           # Isole interattive (SessionWorkspace, LogbookView, SettingsView)
  layouts/           # Layout base Astro
  pages/             # index.astro, logbook.astro, settings.astro, style.astro
  styles/            # tokens.css, reset.css
public/
  models/            # face_landmarker.task + mediapipe wasm files
e2e/                 # Test Playwright (offline, zero-network, a11y, flusso completo)
```

---

## 9. Piano di costruzione (5 Fasi)

### F0 — Setup e Fondamenta
- Inizializzazione progetto Astro + Svelte 5 + TypeScript iper-strict + Biome + Vitest + Playwright.
- Download e verifica licenza (Apache 2.0) di `face_landmarker.task` e dei file WASM in `public/models/`.
- Configurazione `@vite-pwa/astro` e GitHub Actions CI (`pnpm check` + deploy statico).
- **Accettazione**: `pnpm check` verde; app vuota installabile come PWA.

### F1 — Design System ⛔ CANCELLO
- Implementazione `tokens.css` (tema chiaro unico, font locali IBM Plex Sans/Mono) e componenti atomici (`Button`, `Card`, `ProgressBar`, `RatingSelector`, `StatusBadge`, `InlineAlert`).
- Pagina `/style` con tutti i componenti e gli stati.
- **Accettazione**: test contrasto WCAG AA e `prefers-reduced-motion` verdi; `/style` approvata da Krishna.

### F2 — Core Logic (`src/core/`) e Test Unitari
- Implementazione pura di `session/` (timer su timestamp), `focus/` (calibrazione, calcolo segnali, state machine, cooldown, spiegazioni *Why?*), `model/` (Zod) ed `export/` (CSV).
- **Accettazione**: 100% test coverage su `src/core/focus/` e `src/core/session/` con sequenze sintetiche di frame (test di micro-distrazioni ignorate, assenza a 60s, sbadigli, PERCLOS, cooldown 8 min).

### F3 — Sessione Attiva e Camera (Il Cuore) ⛔ CANCELLO
- Implementazione `src/lib/camera.ts` (lazy-loaded), `src/lib/db.ts` (Dexie) e dell'isola `SessionWorkspace` in `/`.
- Flusso completo: Avvio 1-tocco $\rightarrow$ Calibrazione 15s (se necessaria) $\rightarrow$ Monitoraggio 6 fps $\rightarrow$ Banner pausa con *Why?* $\rightarrow$ Chiusura in $\le 10\text{ s}$ con rating 1–5.
- **Accettazione**: sessione funzionante con webcam reale; test Playwright che verifica **zero richieste di rete** durante la sessione; bundle iniziale `/` $< 50\text{ kB}$ gzip. Approvazione sul campo di Krishna.

### F4 — Logbook, Settings, Backup e Offline Audit
- Implementazione `/logbook` (totali, filtri, export CSV) e `/settings` (sensibilità, ricalibrazione, backup cifrato AES-GCM, pagina Privacy, cancella tutto).
- Test e2e completo in modalità offline (Playwright `setOffline(true)`), audit accessibilità `axe-core` a 360px e desktop.
- **Accettazione**: app 100% usabile offline; backup $\rightarrow$ reset $\rightarrow$ ripristino identico; zero violazioni axe.

### F5 — Rilascio Open-Source v3.0.0
- `README.md` chiaro con architettura privacy-first, istruzioni self-hosting e screenshot.
- Tag `v3.0.0` e pubblicazione.