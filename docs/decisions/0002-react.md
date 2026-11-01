# 0002 — React invece di Svelte

**Contesto.** Le parti difficili (visione, voce, ripasso, sincronizzazione) sono indipendenti dal framework. Il framework disegna solo l'interfaccia.

**Alternative.** Svelte 5 (bundle più leggero, codice più corto, controllo dei tipi nei template ancora su TypeScript 6); SolidJS (comunità piccola); Vue (nessun vantaggio rispetto a React qui); Blazor WebAssembly (download pesante, librerie ML in JavaScript).

**Decisione.** React 19 con React Compiler.

**Conseguenze.** Ecosistema ed esempi più ampi, piena compatibilità con TypeScript 7. Il peso iniziale è tenuto sotto controllo dal budget in CI.
