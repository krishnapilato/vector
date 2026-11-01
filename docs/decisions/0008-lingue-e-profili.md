# 0008 — Interfaccia in più lingue, un profilo per persona, esami diversi dal PPL

**Stato:** accettata (v2.0)

## Contesto

Vector è nato per il PPL(A) EASA in italiano. La 2.0 lo apre ad altre persone sullo stesso
dispositivo, ad altri esami e a un’interfaccia in inglese, senza librerie pesanti né server.

## Decisione

- **Traduzioni**: l’italiano è la lingua sorgente e ogni messaggio è la propria chiave
  (`t('Studia')`). Il dizionario inglese è un file a parte caricato solo da chi lo usa, quindi
  non pesa sul bundle iniziale. Le etichette definite nel core sono marcate con `msg()` e
  tradotte dove vengono mostrate; il core che compone testo (METAR, radio, calcolatrice) riceve
  una funzione di traduzione. Un test fallisce se un messaggio non ha la traduzione o se i
  segnaposto `{x}` non coincidono.
- **Profili**: un database IndexedDB per profilo; il primo mantiene il nome originale, quindi
  chi aggiorna non perde niente. Il profilo attivo è ricordato nel browser; cambiarlo ricarica
  l’app, così nessuno stato di un profilo può finire nell’altro.
- **Esami**: un profilo è «PPL(A) EASA» (materie EASA, corso di esempio, radio, meteo,
  strumenti di volo, programma) oppure «un altro esame» con materie definite dall’utente e
  domande generate dai suoi libri. I prompt dell’IA ricevono nome dell’esame e lingua.

## Conseguenze

- I contenuti (corso di esempio PPL, glossario, fraseologia ICAO) restano nella loro lingua: è
  detto nelle impostazioni.
- Aggiungere una lingua significa aggiungere un dizionario e una voce in `languageLabel`.
