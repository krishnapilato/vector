# 0006 — Chiave AI dell'utente, solo sul dispositivo

**Contesto.** L'AI (Gemini, livello gratuito) serve solo per spiegare un concetto in un altro modo. Il repository è pubblico e l'app è statica: non c'è un server dove nascondere una chiave.

**Alternative.** Chiave nel codice o in una variabile `VITE_*` (finirebbe nel bundle pubblico); un proxy su Cloudflare Worker (un servizio in più da gestire, e la chiave sarebbe condivisa tra utenti).

**Decisione.** Ogni utente inserisce la propria chiave nelle impostazioni. Resta in IndexedDB sul suo dispositivo, il browser chiama direttamente l'API di Google, la chiave non entra mai nel repository né nei backup esportati. L'AI riceve solo concetto, testo di riferimento e domanda: nessun dato personale.

**Conseguenze.** Zero costi e zero server; ogni utente ha i propri limiti gratuiti. Il proxy su Worker resta un'opzione se servirà nascondere la chiave o aggiungere limiti.
