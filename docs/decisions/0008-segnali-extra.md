# 0008 — Telefono, postura e mani oltre al viso

Data: 2026-11-13 · Stato: accettata (richiesta di Krishna, anticipa la sezione 15 del piano)

## Contesto
Il piano usa solo Face Landmarker e rimanda dopo la v1.0 il rilevamento del telefono. Krishna ha
chiesto di usare subito i modelli utili: telefono in mano, alzarsi dalla sedia, mano sul viso.

## Decisione
Quattro modelli MediaPipe, tutti serviti dall'app (`public/models`, hash SHA-256 fissati in
`scripts/prepare-models.mjs`) e analizzati solo sul dispositivo:

| Modello | Frequenza | Segnale | Effetto |
|---|---|---|---|
| Face Landmarker | 6 fps (3 se lento) | viso, angoli, occhi, bocca | come sezione 7 |
| Pose Landmarker lite | ~2 fps | altezza delle spalle | alzato ≥ 8 s → «Lost sight of you», pausa a 60 s; accasciato ≥ 90 s → indizio di stanchezza |
| Object Detector (EfficientDet-Lite0, solo «cell phone») | ~1 fps | telefono in vista | ≥ 8 s → distrazione |
| Hand Landmarker | ~1 fps | mano sul viso | ≥ 30 s → indizio di stanchezza |

I modelli extra si alternano: ogni fotogramma ne esegue al massimo due. Si possono spegnere con
«Phone, posture and hands» in Impostazioni; se uno non si carica resta spento senza errori.
La calibrazione salva anche l'altezza media delle spalle (`shoulderY`, nullable).

Scartati: Gesture Recognizer, Image Segmenter, Face Detector, Holistic: doppioni o inutili per
lo studio, con costi di memoria e batteria.

## Conseguenze
- ~18 MB di modelli in più, scaricati e messi in cache quando si accende la fotocamera.
- Nessun dato nuovo salvato oltre agli aggregati della sezione 7.6.
