# Proposte

Idee che non sono nel piano. Non si costruiscono finché Krishna non le approva (sezione 0, regola 4).

## 1. Sincronizzazione tra dispositivi con Supabase, cifrata end-to-end

- **Richiesta**: Krishna, 13 novembre 2026 («dati sincronizzati fra tutti i dispositivi»).
- **Conflitto col piano**: la sezione 1 esclude la sincronizzazione dalla prima versione.
- **Proposta**: dopo la v1.0.0. Il dispositivo cifra l'istantanea (AES-GCM, chiave dalla frase
  segreta) e la carica su Supabase come blob; il server non vede mai i dati. Un altro dispositivo
  con la stessa frase la scarica e la unisce con la stessa funzione di unione dell'import JSON
  (`src/core/backup/merge.ts`), quindi nessun progresso si perde.
- **Serve**: un progetto Supabase di Krishna, una tabella `snapshots (id, ciphertext, updated_at)`
  con Row Level Security, e una CSP che permetta solo quel dominio.
- **Stato**: in attesa di decisione.
