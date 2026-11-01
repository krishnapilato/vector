# 0003 — Biome invece di ESLint + Prettier

**Contesto.** TypeScript 7 non ha ancora un'API programmatica stabile (attesa con la 7.1): gli strumenti che importano il compilatore, come typescript-eslint, non possono ancora usarlo.

**Decisione.** Biome per lint e formattazione: un solo strumento, veloce, indipendente dall'API di TypeScript.

**Conseguenze.** Meno regole basate sui tipi rispetto a typescript-eslint; da rivalutare dopo TypeScript 7.1.
