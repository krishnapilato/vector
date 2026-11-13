# Vector v3 — Piano di costruzione completo

> Documento di riferimento per costruire Vector v3 da zero con Claude Code.
> Autore e responsabile delle decisioni: Krishna Pilato. Redatto il 13 novembre 2026.
> Lingua dell'interfaccia: **solo inglese** (nessuna traduzione, nessuna libreria i18n). Lingua del codice e dei commenti: inglese. Questo documento è in italiano; gli esempi di testo dell'interfaccia scritti in italiano sono indicativi e vanno resi in inglese secondo la sezione 10.
> Tema: **solo chiaro** (nessun tema scuro, nessuna impostazione del tema).

---

## 0. Come usare questo documento (istruzioni per Claude Code)

1. Leggi tutto il documento prima di scrivere codice.
2. Lavora **una fase alla volta** (sezione 14), nell'ordine indicato. Ogni fase ha consegne, criteri di accettazione e test: una fase è finita solo quando tutti i criteri passano e `pnpm check` è verde.
3. Alle fasi segnate **⛔ CANCELLO** fermati e chiedi a Krishna di provare e approvare prima di proseguire.
4. **Non aggiungere funzioni che non sono in questo documento.** Se ti sembra che manchi qualcosa, scrivilo in `docs/proposte.md` e chiedi. La v2 è fallita per eccesso di funzioni: non ripetere l'errore.
5. Quando una scelta tecnica non è decisa qui, scegli la soluzione più semplice e registrala come ADR breve in `docs/decisions/`.
6. Prima di usare una libreria verifica la documentazione aggiornata (Context7 o documentazione ufficiale). Usa sempre l'ultima versione stabile e fissa le versioni nel lockfile.
7. Tutti i testi dell'interfaccia seguono il tono della sezione 10.
8. Commit piccoli e descrittivi, in inglese. Un ramo per fase (`v3/f3-sessione`, …), unito su `v3` quando la fase è chiusa.

---

## 1. Visione

**Vector è il mio compagno di studio per la teoria del PPL(A) EASA.** Non contiene il libro e non fa quiz. Fa tre cose:

1. **Pianifica** quanto studiare ogni mese, settimana e giorno: capitoli del Trebbi, esercizi (regolo, pianificazione, meteo…) e sessioni al simulatore (MSFS 2024, Cessna 172 di default, 4K, zero assistenze).
2. **Accompagna** blocchi di studio attivo da 30 minuti, controllando con la fotocamera (solo in locale) se mi sto distraendo o se sono stanco, e proponendo una pausa al momento giusto.
3. **Registra** tutto in un libretto dello studio, come un logbook di volo, e mostra progressi e traguardi onesti.

Utente: **io, Krishna**, dal primo giorno. Eventuale apertura ad altri utenti solo dopo la v3.0.

### Frase guida

«Apri Vector, premi un pulsante, studi 30 minuti bene. Il resto lo fa l'app.»

### Cosa NON è (fuori ambito per la v3)

- Nessun quiz o banca domande: per i quiz uso **quizppl.it**. Vector pianifica i blocchi di quiz e ne registra il punteggio, nient'altro.
- Nessun lettore di PDF o libro digitale: il Trebbi è cartaceo.
- Nessun microfono.
- Nessuna IA nella v3.0 (quindi nessun proxy di chiavi API per ora, vedi sezione 15).
- Nessun profilo multiplo, nessuna sincronizzazione tra dispositivi.
- Nessuna traduzione: interfaccia solo in inglese. Nessun tema scuro: solo tema chiaro.
- Nessuno streak giornaliero, punto, classifica o notifica che colpevolizza.

---

## 2. Principi (vincolanti)

1. **Privacy per costruzione.** Tutti i dati restano nel browser (IndexedDB). I fotogrammi della fotocamera vengono analizzati in memoria e scartati subito: nessuna immagine viene salvata, mostrata in un'anteprima permanente o inviata. Si salvano solo **aggregati numerici per sessione**. I modelli MediaPipe sono serviti dall'app stessa, non scaricati da server esterni.
2. **Zero attrito.** Avviare una sessione richiede **1 tocco** dalla schermata iniziale. Chiuderla richiede **al massimo 10 secondi**.
3. **Motivazione sana.** Premi legati a progressi reali; obiettivi settimanali flessibili invece di streak; mai senso di colpa (sezione 9).
4. **Gentilezza.** L'app non rimprovera mai. Una pausa proposta è un suggerimento, un arretrato è un «piano aggiornato».
5. **Trasparenza.** Ogni decisione automatica (pausa proposta, piano ricalcolato) è spiegata con un «perché?» in una riga.
6. **Calma visiva.** Sobria ma calda: un colore d'accento, buona tipografia, movimento solo dove aiuta a capire (sezione 11).
7. **Logica pura separata.** Tutto ciò che non è interfaccia vive in `src/core/`, è TypeScript puro senza dipendenze dal browser o dal framework, ed è coperto da test unitari.
8. **Funziona offline** e si installa come PWA su computer e telefono.

---

## 3. Glossario del dominio

| Termine                   | Significato                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Materiale**             | Ciò che si studia: capitoli del Trebbi (con pagine), set di esercizi, lezioni al simulatore.                                                                     |
| **Capitolo**              | Unità del libro: titolo, materia EASA, pagina iniziale e finale, difficoltà 1–3.                                                                                 |
| **Esercizio**             | Tipo di pratica: regolo/flight computer, pianificazione navigazione, meteo (METAR/TAF, carte), peso e centraggio, prestazioni, radio.                            |
| **Lezione al simulatore** | Esercizio MSFS con obiettivi e tolleranze (es. circuito: quota ±100 ft, velocità ±5 kt).                                                                         |
| **Blocco**                | Unità pianificata di lavoro: tipo (lettura, ripasso, esercizio, quiz quizppl, simulatore), durata, contenuto concreto (es. «pag. 112–124»).                      |
| **Sessione**              | Esecuzione reale di un blocco: inizio, fine, minuti attivi, pause, dati di attenzione aggregati, check-in finale.                                                |
| **Modalità**              | `scrivania` (fotocamera disponibile), `in viaggio` (treno/bus: niente fotocamera, blocchi 10–20 min), `simulatore` (niente fotocamera, si registra a fine volo). |
| **Libretto**              | Lo storico delle sessioni, presentato come un logbook.                                                                                                           |
| **Traguardo**             | Tappa significativa del percorso (sezione 9).                                                                                                                    |
| **Chiarezza**             | Autovalutazione 1–5 a fine sessione su quanto è chiaro l'argomento.                                                                                              |

Materie EASA PPL(A) (per classificare capitoli ed esercizi), con i nomi inglesi usati nell'interfaccia: Air Law, Human Performance and Limitations, Meteorology, Communications, Principles of Flight, Operational Procedures, Flight Performance and Planning, Aircraft General Knowledge, Navigation.

Nomi nell'interfaccia: Block, Session, Logbook, Milestone, Materials, Clarity (1–5), modalità Desk / On the go / Simulator.

---

## 4. Mappa delle schermate

Navigazione principale (barra in basso su telefono, laterale su computer): **Today · Plan · Logbook · Milestones**. Settings e Materials raggiungibili da un'icona.

| Rotta          | Schermata (etichetta UI)                  | Scopo                                                     |
| -------------- | ----------------------------------------- | --------------------------------------------------------- |
| `/`            | Oggi (**Today**)                          | Il prossimo blocco già pronto e un pulsante «Start».      |
| `/session`     | Sessione (**Session**)                    | Timer, stato di concentrazione, pausa.                    |
| `/session/end` | Fine sessione (**Wrap-up**)               | Check-in di 10 secondi.                                   |
| `/plan`        | Piano (**Plan**)                          | Vista settimana e mese, modifica, export calendario.      |
| `/week`        | Revisione settimanale (**Weekly review**) | Rituale di 2 minuti la domenica.                          |
| `/logbook`     | Libretto (**Logbook**)                    | Storico sessioni e statistiche.                           |
| `/milestones`  | Traguardi (**Milestones**)                | Tappe raggiunte e prossime.                               |
| `/materials`   | Materiale (**Materials**)                 | Capitoli del Trebbi, esercizi, lezioni MSFS.              |
| `/settings`    | Impostazioni (**Settings**)               | Disponibilità, fotocamera, calibrazione, backup, privacy. |
| `/welcome`     | Primo avvio (**Welcome**)                 | 4 passi di configurazione.                                |
| `/style`       | Guida di stile                            | Pagina interna del design system (non in navigazione).    |

---

## 5. Funzioni nel dettaglio

### 5.1 Primo avvio (`/welcome`) — massimo 4 passi, saltabili

1. **Obiettivo**: data indicativa per finire la teoria (facoltativa; senza data il piano usa il ritmo settimanale).
2. **Disponibilità**: per ogni giorno della settimana, quanti blocchi da 30 min e in che fascia (mattina / pausa pranzo / sera / in viaggio).
3. **Materiale**: carica l'elenco dei capitoli del Trebbi da `src/content/trebbi.json` (precompilato da Krishna, sezione 16) e permette di correggerlo.
4. **Ritmo**: pagine lette in 30 minuti (valore iniziale 6, poi misurato dalle sessioni reali).

### 5.2 Oggi (`/`)

- In alto: saluto breve con data, e **obiettivo della settimana** come barra («3 di 5 blocchi»).
- Al centro: **una scheda** con il prossimo blocco: tipo, contenuto concreto («Trebbi · Cap. 4 Portanza · pag. 112–124»), durata, modalità. Pulsante primario **Inizia**.
- Sotto: «Altro per oggi» (blocchi rimanenti, compressi) e **«Ho solo 10 minuti»** che propone un blocco breve adatto (ripasso o esercizio).
- Se oggi non è previsto nulla: proposta neutra («Oggi è libero. Vuoi fare un blocco extra?»), mai un rimprovero.
- Se il simulatore è sbloccato in settimana, la scheda lo dice con calore («Hai sbloccato il volo di questa settimana»).

### 5.3 Sessione (`/session`)

- **Timer basato su timestamp** (porta `core/pomodoro.ts` della v2): sopravvive a ricarica e chiusura, riprende esattamente.
- Durata predefinita 30 min; il tempo è **nascosto di default** e si mostra toccando l'area del timer per 2 secondi (riduce l'ansia da orologio). Impostazione per mostrarlo sempre.
- Indicatore discreto della fotocamera (punto colorato + testo «Fotocamera attiva, solo su questo dispositivo»).
- Stato attuale in una parola, senza giudizio: «Concentrato», «Ti ho perso di vista», «Pausa?».
- Pulsanti: **Pausa**, **Termina**. «Termina» prima del tempo chiede solo «Vuoi registrare i minuti fatti?» (sì di default).
- Contenuto del blocco sempre visibile (pagine, esercizio), con campo «sono arrivato a pag. ___» facoltativo.
- Fine del tempo: suono breve e morbido (disattivabile) e passaggio a Fine sessione.
- Uscita dall'app durante una sessione da scrivania: il timer si mette in pausa automaticamente dopo 60 s fuori e registra l'uscita (configurabile).

### 5.4 Fine sessione (`/session/end`)

Tre input, tutti con valori predefiniti, completabili in 10 secondi:

1. **Chiarezza 1–5** (cinque pulsanti grandi).
2. **Dove sono arrivato** (pagina, precompilata con la stima).
3. **Nota** facoltativa in una riga.
   Per blocchi `quiz`: campo punteggio quizppl.it (es. 18/20). Per blocchi `simulatore`: esercizio volato, esito (riuscito / da rifare), deviazioni principali (testo libero breve).
   Poi una **riga di riscontro** onesta (es. «32 minuti attivi, attenzione 84%. Capitolo 4 al 60%.») e ritorno a Oggi.

### 5.5 Piano (`/plan`)

- **Vista settimana** (predefinita): 7 colonne/righe con i blocchi; trascinamento o menu per spostare; tocco per modificare.
- **Vista mese**: carico per settimana e capitoli previsti, avanzamento verso l'obiettivo.
- **Rigenera** con spiegazione di cosa cambia, e anteprima prima di confermare.
- **Esporta .ics** per Google Calendar (porta l'export della v2): è il meccanismo dei promemoria, perché una PWA senza server non può programmare notifiche affidabili.
- Algoritmo nella sezione 6.

### 5.6 Revisione settimanale (`/week`)

Proposta la domenica (o al primo avvio del lunedì), facoltativa, 2 minuti:

1. Riepilogo: blocchi fatti, ore attive, capitoli avanzati, momento migliore della settimana.
2. «Com'è andata?» (3 opzioni: pesante / giusta / leggera).
3. Il piano della settimana dopo si adatta (−15% / invariato / +10%) e lo mostra.

### 5.7 Libretto (`/logbook`)

- Elenco cronologico in stile logbook: data, tipo, contenuto, durata attiva, attenzione, chiarezza, nota.
- Totali in alto: ore di studio attivo (totale, mese, settimana), ore di simulatore, capitoli completati.
- Statistiche semplici: **orari in cui rendo meglio** (attenzione media per fascia oraria), andamento della chiarezza per materia, punteggi quizppl per capitolo.
- Filtri per materia e tipo. Esportazione CSV.

### 5.8 Traguardi (`/milestones`)

Vedi sezione 9.

### 5.9 Materiale (`/materials`)

- **Trebbi**: capitoli con materia, pagine, difficoltà, stato (da iniziare / in corso con % / completato / da ripassare).
- **Esercizi**: tipi di esercizio con fonte (es. «regolo — esercizi del manuale del CRP-5», «METAR reali di LIMC»), frequenza desiderata.
- **Simulatore**: elenco ordinato di lezioni MSFS (sezione 16) con obiettivi e tolleranze, stato e numero di tentativi.
- Tutto modificabile; i dati iniziali vengono da file JSON in `src/content/`.

### 5.10 Impostazioni (`/settings`)

Disponibilità settimanale · ritmo di lettura · durata blocchi · ripartizione libro/esercizi/simulatore · fotocamera (on/off, sensibilità, ricalibra) · suoni · mostra timer · **backup** (esporta/importa file, cifrato con frase segreta) · **Privacy**: pagina che spiega cosa viene analizzato e cosa viene salvato · **Cancella tutto**.

---

## 6. Algoritmo di pianificazione (`src/core/planner/`)

Funzioni pure, deterministiche, testate.

**Input**: data obiettivo (facoltativa), disponibilità settimanale (slot), capitoli (pagine, difficoltà, stato), esercizi, lezioni MSFS, ritmo (pagine per 30 min, misurato), ripartizione (default **60% libro · 25% esercizi · 15% simulatore**), storico sessioni, esito revisione settimanale.

**Passi**

1. **Carico mensile**: pagine rimanenti pesate per difficoltà (peso 1 / 1,3 / 1,6) divise per i mesi rimanenti; senza data, si usa la capacità settimanale.
2. **Carico settimanale**: numero di blocchi = slot disponibili × fattore della revisione settimanale; ripartiti per tipo secondo la ripartizione.
3. **Contenuto concreto**: i blocchi di lettura ricevono intervalli di pagine consecutivi (`ritmo × difficoltà`), senza spezzare un capitolo a meno di 2 pagine dalla fine.
4. **Ripasso spaziato**: un capitolo chiuso con chiarezza ≤ 3 genera blocchi di ripasso a +3, +7 e +21 giorni; con chiarezza 4–5 un solo ripasso a +14 giorni.
5. **Quiz dopo la comprensione**: un blocco `quiz` (quizppl.it) per un capitolo si pianifica **solo dopo** averlo letto e averlo valutato con chiarezza ≥ 3, mai prima. Obiettivo: evitare di imparare i quiz a memoria.
6. **Varietà**: mai più di 2 giorni consecutivi con lo stesso tipo di blocco come primo del giorno; alternare materie quando possibile.
7. **Simulatore sbloccato**: la sessione MSFS della settimana è «sbloccata» dopo 3 blocchi di teoria completati nella stessa settimana (configurabile). Prima resta visibile ma segnata come «si sblocca dopo 3 blocchi».
8. **Modalità in viaggio**: negli slot marcati «in viaggio» si mettono solo blocchi brevi (10–20 min) adatti al telefono: ripasso, glossario personale, quiz.
9. **Ricalcolo**: i blocchi saltati non si accumulano come arretrato. Si ridistribuiscono sulle settimane successive con un aumento massimo del **+20%** per settimana; se non bastano, la data obiettivo stimata si sposta e lo si dice in una riga.
10. **Spiegazione**: ogni piano generato produce un breve testo `perché` («Ho aggiunto un ripasso del cap. 3 perché l'hai valutato 2/5»).

**Test minimi**: carico corretto con e senza data; nessun quiz prima della lettura; ripassi alle date giuste; ricalcolo senza superare +20%; simulatore sbloccato al terzo blocco; determinismo (stesso input → stesso piano).

---

## 7. Modulo concentrazione con fotocamera (`src/core/focus/` + `src/islands/focus/`)

### 7.1 Tecnologia

- `@mediapipe/tasks-vision`, **Face Landmarker** (non Face Detection): 478 punti, 52 blendshapes, matrice di trasformazione del viso. `runningMode: 'VIDEO'`, `numFaces: 1`, `delegate: 'GPU'` con ripiego CPU.
- File del modello (`face_landmarker.task`) e WASM **serviti dall'app** in `public/models/` e messi in cache dal service worker: funziona offline e nessuna richiesta verso Google. Verifica licenza (Apache 2.0) e peso.
- Fotocamera a bassa risoluzione (320×240) e **campionamento a 6 fotogrammi al secondo**, solo mentre la sessione è attiva e la pagina è visibile.
- Gira in un'isola Svelte con `client:only="svelte"`, caricata solo nella pagina Sessione e solo se la fotocamera è attiva.
- Porta e semplifica dalla v2: `src/app/focus/sensors.ts` (solo la parte fotocamera; togli microfono e rilevamento telefono) e `src/core/focus/focus.ts` (classificazione e accumulo).

### 7.2 Segnali per fotogramma (in memoria, mai salvati)

`facePresent`, `yaw`, `pitch`, `roll` (dalla matrice), `eyesClosed` (blendshapes `eyeBlinkLeft` e `eyeBlinkRight` > soglia), `jawOpen`, direzione dello sguardo (`eyeLook*`).

### 7.3 Calibrazione (obbligatoria alla prima sessione, poi a richiesta)

20 secondi: «Read your book the way you usually do». Si registrano media e deviazione standard di yaw e pitch nella **posizione di lettura**: con un libro cartaceo la testa è abbassata per gran parte del tempo e **non è una distrazione**. Si salvano solo questi numeri, per postazione (es. «scrivania camera», «scrivania ufficio»).

### 7.4 Segnali derivati (finestra mobile di 60 s)

- **Assenza**: secondi senza viso.
- **Sguardo altrove**: testa fuori dalla posizione di lettura calibrata (|Δyaw| > max(25°, 3σ) o Δpitch oltre la soglia verso l'alto); valori iniziali da calibrare con Krishna.
- **Occhi chiusi prolungati**: occhi chiusi > 1,5 s di fila.
- **PERCLOS**: percentuale di tempo con occhi chiusi nella finestra.
- **Sbadigli**: `jawOpen` > 0,6 per > 1,5 s; contati negli ultimi 10 min.
- **Irrequietezza**: varianza dei movimenti della testa rispetto alla media personale.

### 7.5 Stati e regole

| Stato             | Condizione                                                       | Reazione                                         |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Concentrato       | nessun segnale oltre soglia                                      | nulla                                            |
| Distrazione breve | segnale < 8 s                                                    | ignorata (guardare un appunto, starnutire)       |
| Distratto         | sguardo altrove ≥ 8 s                                            | indicatore discreto, conta nell'attenzione       |
| Assente           | nessun viso ≥ 60 s                                               | pausa automatica del timer                       |
| Affaticato        | PERCLOS alto, ≥ 3 sbadigli in 10 min, o irrequietezza in aumento | proposta gentile: «5 minuti di pausa e riparti?» |

- **Non si parla mai di «noia»**: si chiama **indice di stanchezza**, ed è un indizio, non un giudizio. Il riconoscimento delle emozioni dal viso non è affidabile.
- Una proposta di pausa non si ripete prima di 8 minuti; se rifiutata due volte, la sensibilità si abbassa per quella sessione.
- Pulsante «Perché?» accanto a ogni proposta: elenca i segnali che l'hanno causata.
- Sensibilità regolabile (bassa / normale / alta).

### 7.6 Cosa si salva per ogni sessione

Solo aggregati: minuti attivi, secondi per stato, numero di distrazioni, numero di proposte di pausa (accettate/rifiutate), **attenzione %** = secondi «concentrato» ÷ secondi attivi, indice di stanchezza medio e massimo.

### 7.7 Prestazioni e limiti

- Budget: analisi < 30 ms per fotogramma su un portatile medio; se superato, il campionamento scende a 3 fps.
- Pagina nascosta: campionamento sospeso (il browser rallenta comunque i timer delle schede nascoste).
- **Sessioni al simulatore senza fotocamera**: MSFS a schermo intero manda la web app in secondo piano. Si pianificano e si registrano a fine volo.
- Se la fotocamera viene negata o non c'è: la sessione funziona lo stesso, senza dati di attenzione.

### 7.8 Test

Tutta la logica di `src/core/focus/` è testata con **sequenze sintetiche** di campioni (nessuna registrazione reale): soglie, distrazioni brevi ignorate, pausa automatica a 60 s, proposta di pausa e suo intervallo minimo, calcolo dell'attenzione.

---

## 8. Dati (`src/core/model/` + `src/lib/db.ts`)

IndexedDB con **Dexie**; schemi validati con **Zod**; migrazioni versionate.

Tabelle:

- `settings` (unica riga): disponibilità, ritmo, ripartizione, fotocamera, sensibilità, suoni, data obiettivo.
- `chapters`: id, ordine, titolo, materia, paginaInizio, paginaFine, difficoltà, paginaRaggiunta, stato, chiarezzaUltima.
- `exercises`: id, tipo, titolo, fonte, frequenzaSettimanale.
- `simLessons`: id, ordine, titolo, obiettivi, tolleranze, stato, tentativi.
- `blocks`: id, data, ora, durata, tipo, riferimento (capitolo/esercizio/lezione), contenuto, modalità, stato (previsto/fatto/saltato/spostato), perché.
- `sessions`: id, bloccoId, inizio, fine, minutiAttivi, pause, chiarezza, paginaRaggiunta, nota, punteggioQuiz, esitoSim, focus (aggregati della 7.6).
- `calibrations`: postazione, mediaYaw, sdYaw, mediaPitch, sdPitch, data.
- `milestones`: id, raggiuntoIl.
- `weeklyReviews`: settimana, sensazione, fattore.

Altro:

- Richiedere `navigator.storage.persist()` al primo avvio, per ridurre il rischio che il browser cancelli i dati (importante su iOS).
- **Backup**: esportazione JSON completa, cifrata con frase segreta (porta `src/core/sync/crypto.ts` della v2, solo la parte di cifratura del file). Importazione con anteprima e conferma.
- Promemoria a ogni lunedì se l'ultimo backup ha più di 14 giorni (una riga in Oggi, non una notifica).

---

## 9. Motivazione e premi

### Si fa

- **Obiettivo settimanale flessibile**: «N blocchi su 7 giorni», in qualunque giorno. Nessun conteggio di giorni consecutivi.
- **Progressi reali**: ore attive, capitoli completati, % del Trebbi, lezioni MSFS superate. Ogni numero corrisponde a qualcosa di concreto.
- **Libretto come logbook**: il piacere di rileggere quanto si è fatto.
- **Simulatore come ricompensa** che sblocca a metà settimana (sezione 6, punto 7).
- **Traguardi pochi e significativi**, per esempio:
  - Prima sessione completa · Prima settimana completata
  - 10 / 25 / 50 / 100 ore di studio attivo
  - Ogni capitolo del Trebbi completato · Ogni materia EASA completata · Trebbi completato
  - Prima navigazione pianificata a mano · Primo esercizio al regolo senza errori
  - Primo circuito MSFS entro le tolleranze · Prima navigazione MSFS completata
- Quando si raggiunge un traguardo: una scheda tranquilla in Oggi con una frase e la data, consultabile poi in Traguardi. Niente coriandoli, niente suoni trionfali.
- In Traguardi si vedono anche le **prossime tappe** con quanto manca, per dare direzione.

### Non si fa

- Streak che si azzerano · punti · livelli · classifiche · badge per azioni banali (es. «hai aperto l'app»).
- Notifiche o testi che colpevolizzano («Non studi da 3 giorni!»).
- Numeri in rosso per gli arretrati.

---

## 10. Tono di voce

- **Inglese semplice e chiaro**, rivolto direttamente a me («you»), frasi brevi, niente gergo da app.
- Calmo e concreto, come un buon istruttore: dice cosa fare e perché, non giudica.
- Termini aeronautici nella forma usata da EASA e ICAO (es. «Principles of Flight», «circuit», «go-around»).
- Esempi: «Ready when you are.» · «Take 5 minutes, then pick it up again?» · «Plan updated: chapter 5 moves to Tuesday.» · «Lost sight of you, timer paused.» · «32 active minutes, 84% focus. Chapter 4 is 60% done.»
- Mai: punti esclamativi a raffica, ironia sugli errori, parole come «failed», «lazy», «behind», «overdue».
- Tutte le stringhe dell'interfaccia in un unico file `src/lib/copy.ts` (niente i18n), così le stesse cose si chiamano sempre allo stesso modo.
- I contenuti restano nella loro lingua: titoli dei capitoli del Trebbi in italiano, come nel libro.

---

## 11. Design system

Prima fase dopo l'impostazione (F1), con **⛔ CANCELLO**: Krishna approva la pagina `/style` prima di costruire le schermate.

**Token** (proprietà CSS in `src/styles/tokens.css`, unica fonte di verità). **Un solo tema, chiaro**: nessun `prefers-color-scheme`, nessun `data-theme`, nessuna impostazione. Motivi: si legge bene accanto al libro di carta e, la sera, lo schermo chiaro illumina il viso e migliora l'analisi della fotocamera. Imposta `color-scheme: light` così il browser non applica scurimenti automatici.

- **Colori**: fondo, superficie, superficie rialzata, testo, testo secondario, bordo, **un accento** (proposta: blu profondo, «vettore»), successo, attenzione; definiti in OKLCH, contrasto WCAG AA verificato da test.
- **Tipografia** (font serviti in locale con `@fontsource`): un sans per il testo e un mono per numeri, timer e statistiche (proposta: IBM Plex Sans + IBM Plex Mono). Scala tipografica di 6 livelli. Numeri tabulari ovunque ci siano cifre.
- **Spaziatura**: scala 4 px (4, 8, 12, 16, 24, 32, 48, 64).
- **Raggi, ombre, spessori bordo**: 3 livelli ciascuno.
- **Movimento**: durate 120 / 200 ms, una curva di easing; solo per cambi di stato (apertura, comparsa di una scheda). Con `prefers-reduced-motion: reduce` nessuna animazione, verificato da un test.

**Componenti base** (Svelte, in `src/components/`): Pulsante (primario, secondario, discreto), Scheda, Barra di avanzamento, Scelta 1–5, Campo testo, Interruttore, Selettore segmentato, Indicatore fotocamera, Timer, Riga di libretto, Scheda traguardo, Finestra di conferma, Avviso in linea, Stato vuoto.

**Stati vuoti**: ogni schermata ha un testo utile quando non ci sono dati (es. Libretto vuoto: «Qui comparirà ogni sessione, come in un logbook. Inizia la prima da Oggi.»).

**Accessibilità**: navigazione completa da tastiera, focus visibile, etichette per lettori di schermo, aree toccabili ≥ 44 px, nessuno scorrimento orizzontale a 360 px di larghezza; verifica con axe-core nei test end-to-end.

**Logo**: astratto e generico, non legato al volo (decisione di Krishna). Segnaposto semplice fino a una proposta dedicata.

---

## 12. Architettura e stack

- **Astro** (ultima stabile), output statico, deploy su GitHub Pages con base `/vector/`.
- **Svelte 5** (runes) per le isole interattive: Sessione, Fine sessione, Piano, Impostazioni, Primo avvio. Le altre pagine il più possibile statiche con piccole isole.
- **TypeScript** in modalità `strict`.
- **CSS** con proprietà personalizzate e stili scoped di Svelte (niente Tailwind, così i token restano un'unica fonte).
- **Dexie** (IndexedDB), **Zod** (schemi e contenuti), **@mediapipe/tasks-vision**.
- **PWA**: `@vite-pwa/astro`, precache di app, font, modello e WASM; installabile; funziona offline.
- **Qualità**: Biome (lint e formattazione), Vitest (unit), Playwright + axe-core (end-to-end e accessibilità), budget di peso: pagina Oggi < 60 kB gzip di JS; modello e WASM esclusi e caricati solo in Sessione.
- **Gestore pacchetti**: pnpm. Node secondo `.nvmrc`.
- **CI** GitHub Actions: `pnpm check` (typecheck, lint, test, build, budget) + e2e; deploy Pages dopo CI verde su `main` (riusa `pages.yml` della v2, adattato all'output `dist/` di Astro).

### Struttura

```
src/
  core/            logica pura, nessuna dipendenza da browser o framework
    planner/       algoritmo di pianificazione
    focus/         classificazione, stati, aggregati
    session/       timer basato su timestamp
    milestones/    regole dei traguardi
    model/         tipi e schemi Zod
    calendar/      date, settimane, export .ics
  lib/             adattatori del browser: db.ts (Dexie), camera.ts, backup.ts, sound.ts, copy.ts
  components/      componenti Svelte del design system
  islands/         isole Svelte per pagina (session/, plan/, onboarding/, settings/, focus/)
  layouts/         layout Astro
  pages/           rotte Astro (sezione 4)
  content/         dati iniziali in JSON: trebbi.json, exercises.json, sim-lessons.json
  styles/          tokens.css, base.css
public/
  models/          face_landmarker.task, WASM di MediaPipe
docs/
  decisions/       ADR
  PIANO-V3.md      questo documento
e2e/               test Playwright
```

### Regola d'oro

`src/core/` non importa mai da `src/lib/`, `src/islands/` o Astro. I test di `core` girano in millisecondi in Node.

---

## 13. Cosa portare dalla v2

Prima di cancellare, crea il tag `v2-final`. Poi porta, adattando a TypeScript strict e ai nuovi tipi, **con i rispettivi test**:

| Da (v2)                    | A (v3)               | Note                                                                                                           |
| -------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/core/focus/focus.ts`  | `src/core/focus/`    | Tieni classificazione e accumulo; togli voce e telefono; aggiungi calibrazione, PERCLOS, sbadigli, stanchezza. |
| `src/app/focus/sensors.ts` | `src/lib/camera.ts`  | Solo fotocamera e Face Landmarker; modello servito in locale.                                                  |
| `src/core/pomodoro.ts`     | `src/core/session/`  | Timer su timestamp, ripresa dopo chiusura.                                                                     |
| `src/core/plan.ts`         | `src/core/calendar/` | Funzioni di data (settimana dal lunedì) ed export `.ics`.                                                      |
| `src/core/sync/crypto.ts`  | `src/lib/backup.ts`  | Solo cifratura del file di backup.                                                                             |
| `src/core/random.ts`       | `src/core/`          | Se serve al pianificatore deterministico.                                                                      |

Tutto il resto della v2 (quiz, lettore PDF, penna, radio, METAR, glossario, profili, sync, i18n, IA) **non si porta**.

---

## 14. Fasi di costruzione

Krishna inizia a usare Vector ogni giorno **dalla fine della F3**.

### F0 — Preparazione

- Tag `v2-final` su `main`; ramo `v3`; rimozione del codice v2 (resta nel tag).
- Progetto Astro + Svelte + TypeScript strict, Biome, Vitest, Playwright, CI, deploy Pages.
- `CLAUDE.md` alla radice con le regole della sezione 0 e il riassunto dei principi.
- Nuovo `README.md` breve; ADR 0001 «Ripartenza v3: perché e cosa cambia».
- **Accettazione**: `pnpm check` verde; pagina di prova pubblicata su Pages; installabile come PWA.

### F1 — Design system ⛔ CANCELLO

- Token, font locali, tema chiaro unico, componenti base, pagina `/style` con tutti i componenti in tutti gli stati.
- **Accettazione**: contrasto AA verificato da test; nessuna animazione con riduzione del movimento (test); `/style` approvata da Krishna.

### F2 — Modello dati, materiale e primo avvio

- Schemi Zod, Dexie con migrazioni, file in `src/content/`, schermata Materiale, Primo avvio in 4 passi, Impostazioni di base.
- **Accettazione**: dati persistenti dopo ricarica; contenuti iniziali validati da Zod in build; primo avvio completabile in meno di 2 minuti.

### F3 — Oggi, Sessione, Fine sessione, Libretto ⛔ CANCELLO

- Pianificazione semplice provvisoria (prossimo capitolo in ordine), timer su timestamp con ripresa, check-in di 10 secondi, Libretto con totali, modalità in viaggio e simulatore.
- **Accettazione**: da Oggi a sessione avviata in 1 tocco; chiusura in ≤ 10 s; sessione ripresa dopo chiusura del browser (test e2e); Krishna la usa per 3 giorni e dà riscontro.

### F4 — Pianificatore completo e revisione settimanale

- Algoritmo della sezione 6 con spiegazioni «perché», vista settimana e mese, modifica dei blocchi, export `.ics`, revisione settimanale.
- **Accettazione**: tutti i test della sezione 6; piano rigenerato con anteprima; .ics importato correttamente in Google Calendar (prova manuale).

### F5 — Concentrazione con fotocamera ⛔ CANCELLO

- Porting dalla v2, calibrazione per postazione, segnali derivati, stati e regole, proposta di pausa con «Perché?», aggregati in Libretto, pagina Privacy.
- **Accettazione**: test della sezione 7.8; nessuna richiesta di rete durante l'analisi (verificato in e2e); budget di prestazioni rispettato; soglie regolate con Krishna dopo una settimana d'uso.

### F6 — Traguardi e statistiche

- Regole dei traguardi (pure, testate), schermata Traguardi con prossime tappe, schede in Oggi, statistiche del Libretto (orari migliori, chiarezza per materia, punteggi quiz).
- **Accettazione**: ogni traguardo ha un test; nessun elemento della lista «Non si fa» della sezione 9.

### F7 — Offline, backup, robustezza

- Precache completo, `storage.persist()`, backup cifrato e ripristino con anteprima, promemoria backup, gestione errori (fotocamera negata, quota piena, database da migrare).
- **Accettazione**: app usabile in modalità aereo dopo il primo caricamento (e2e); backup → cancella tutto → ripristino identico (test).

### F8 — Rifinitura anti-noia

- Revisione di ogni testo con la sezione 10; stati vuoti; layout telefono a 360 px; accessibilità con axe; **audit della noia** (sotto).
- **Accettazione**: zero violazioni axe; checklist dell'audit completata con Krishna.

### F9 — Rilascio v3.0

- Tag `v3.0.0`, release, README con screenshot, ADR aggiornati, unione di `v3` su `main`.

### Audit della noia (checklist per F8)

- [ ] Iniziare una sessione richiede 1 tocco da Oggi.
- [ ] Chiudere una sessione richiede ≤ 10 s.
- [ ] Nessuna schermata chiede dati che l'app può stimare da sola.
- [ ] Nessun testo ripetuto identico più di una volta al giorno nello stesso punto (variare i saluti e i riscontri con poche alternative).
- [ ] Nessun numero rosso, nessun arretrato mostrato come debito.
- [ ] Ogni attesa > 300 ms ha un'indicazione di caricamento.
- [ ] La settimana tipo non ha tre giorni uguali di fila.
- [ ] Il simulatore compare come premio almeno una volta a settimana se la teoria è stata fatta.

---

## 15. Dopo la v3.0 (non costruire ora)

- **Companion MSFS 2024**: lettura dei dati di volo (SimConnect) e confronto con le tolleranze EASA del test di volo; registrazione automatica nel Libretto.
- **Proxy delle chiavi API** su Google Cloud Run functions (in Go) solo se tornerà una funzione di IA, con autenticazione, limite di richieste per utente e budget con avviso.
- **App Android** impacchettando la PWA con Capacitor.
- Rilevamento del telefono in mano (Object Detector), se utile e con budget di prestazioni.
- Apertura ad altri utenti (profili, materiale diverso dal Trebbi).

---

## 16. Dati da preparare (Krishna, prima della F2)

1. **Indice del Trebbi** in `src/content/trebbi.json`: per ogni capitolo titolo, materia EASA, pagina iniziale e finale, difficoltà percepita 1–3. Indicare l'edizione del libro.
2. **Disponibilità settimanale** tipica, incluse le finestre in treno e bus.
3. **Data obiettivo** indicativa per finire la teoria (facoltativa).
4. **Esercizi**: strumenti e fonti disponibili (modello di regolo/flight computer, carte, sito per METAR/TAF).
5. **Lezioni MSFS** in ordine, con obiettivi e tolleranze. Proposta iniziale da rivedere: preparazione e checklist · rullaggio · decollo e salita · volo rettilineo livellato · virate a 15° e 30° · salite e discese · volo lento · stalli e recupero · circuito · atterraggio normale · atterraggio con vento al traverso · riattaccata · avaria motore simulata · navigazione stimata breve · navigazione con radioassistenze.
6. **Postazioni di studio** con fotocamera (dove si trova la webcam rispetto al libro).

Formato dei file (validato da Zod in build):

```json
// src/content/trebbi.json
{
  "edizione": "…",
  "capitoli": [
    { "id": "cap-01", "ordine": 1, "titolo": "…", "materia": "principi-del-volo", "paginaInizio": 1, "paginaFine": 24, "difficolta": 2 }
  ]
}
```

---

## 17. Rischi e mitigazioni

| Rischio                                          | Mitigazione                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Ritorno all'eccesso di funzioni                  | Sezione 1 «Fuori ambito», regola 4 della sezione 0, `docs/proposte.md`.                           |
| Falsi allarmi della fotocamera (testa sul libro) | Calibrazione per postazione, distrazioni brevi ignorate, sensibilità regolabile, «Perché?».       |
| Dati cancellati dal browser (soprattutto iOS)    | `storage.persist()`, PWA installata, promemoria di backup.                                        |
| Prestazioni sul portatile                        | 6 fps, bassa risoluzione, GPU con ripiego, budget per fotogramma, caricamento solo in Sessione.   |
| Il piano diventa una fonte di ansia              | Obiettivi settimanali flessibili, ricalcolo senza arretrati, tono gentile, revisione settimanale. |
| Uso dei quiz come scorciatoia mnemonica          | Quiz pianificati solo dopo lettura e chiarezza ≥ 3.                                               |
