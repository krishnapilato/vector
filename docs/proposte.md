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
- **Stato**: approvata da Krishna il 13 novembre 2026 e costruita (ADR 0005).

## 2. Verifica della fotocamera con la maglia del viso

- **Richiesta**: Krishna, 13 novembre 2026 («per test si veda cosa riprende e cosa capisce»).
- **Rapporto col piano**: la sezione 2 esclude solo un'anteprima *permanente*. Questa è temporanea,
  aperta a mano in Impostazioni, mai durante una sessione; nulla viene salvato.
- **Cosa fa**: immagine dal vivo specchiata con sopra la maglia del viso di MediaPipe (contorno,
  occhi, iridi, bocca) e i numeri usati dall'app: angoli della testa rispetto alla calibrazione,
  occhi chiusi, bocca aperta, stato attuale. Utile anche per tarare le soglie (sezione 7.4).
- **Stato**: costruita.

## 3. Anteprima morbida della fotocamera durante la sessione

- **Richiesta**: Krishna, 13 novembre 2026 («mostrarla sempre… come background soft»).
- **Conflitto col piano**: la sezione 2 esclude un'anteprima permanente dell'immagine.
- **Proposta**: impostazione spenta di default. Se attiva, una miniatura piccola, sfocata e a bassa
  opacità in un angolo della sessione, con la maglia del viso leggera. Nulla viene salvato.
- **Stato**: in attesa di decisione.

## 4. Riconoscere gli oggetti attorno (telefono in mano)

- **Richiesta**: Krishna, 13 novembre 2026.
- **Rapporto col piano**: previsto dopo la v1.0 (sezione 15), con budget di prestazioni.
- **Proposta**: MediaPipe Object Detector (EfficientDet-Lite0, ~4–5 MB, servito dall'app) a 1–2 fps
  solo per la classe «cell phone»; nuovo segnale «telefono in vista» con la stessa regola delle
  distrazioni brevi (ignorato sotto gli 8 s). Mani e corpo (es. «mi alzo dalla sedia») con Hand
  o Pose Landmarker: alzarsi è già coperto oggi dall'assenza del viso (pausa dopo 60 s).
- **Stato**: in attesa di decisione.
