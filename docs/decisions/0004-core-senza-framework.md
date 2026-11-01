# 0004 — Logica pura fuori dal framework

**Contesto.** Motore dei quiz, ripasso, profilo di apprendimento, attenzione e sincronizzazione sono il cuore dell'app e devono essere affidabili.

**Decisione.** Vivono in `src/core` come moduli TypeScript puri: niente React, niente API del browser. L'interfaccia li chiama.

**Conseguenze.** Test unitari in millisecondi con copertura minima obbligatoria; i loop di fotocamera e microfono non rallentano l'interfaccia; cambiare framework significherebbe riscrivere solo le schermate.
