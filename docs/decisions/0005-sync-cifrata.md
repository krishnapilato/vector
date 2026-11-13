# 0005 — Sync tra dispositivi cifrata end-to-end su Supabase

Data: 2026-11-13 · Stato: accettata (richiesta di Krishna, anticipa la sezione 15 del piano)

## Decisione
- Progetto Supabase dedicato `vector` (eu-central-1, piano gratuito). Una tabella `vaults`
  (id, hash del token, testo cifrato, versione) con RLS attiva e **nessuna** policy: il ruolo
  `anon` non può leggerla né scriverla.
- Tre funzioni `security definer` (`vault_get`, `vault_put`, `vault_delete`), eseguibili solo da
  `anon`, verificano lo SHA-256 del token. `vault_put` usa un controllo di versione ottimistico.
- Dalla frase segreta il dispositivo deriva con PBKDF2 (600.000 giri, sale per scopo) l'id del
  vault, il token e una chiave AES-256-GCM non estraibile salvata in IndexedDB. La frase non viene
  salvata. Il server vede solo id, hash del token, dimensione e data.
- Ciclo: scarica, decifra, unisce (ADR 0004), carica con la versione attesa; in caso di conflitto
  riprova. Gira all'apertura, al ritorno online o in primo piano e 4 s dopo ogni modifica.
- Nessun proxy: la chiave pubblicabile di Supabase è pensata per stare nel browser e raggiunge
  solo le tre funzioni. Il codice di sync (e Zod) si carica solo quando la sync è attiva.

## Conseguenze
- La CSP permette, oltre all'origine dell'app, solo `https://gjerxjpchkyuddjiobze.supabase.co`.
- Una frase dimenticata non si può recuperare. Limite di 2 MB per vault.
