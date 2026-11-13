# 0002 — GitHub Pages pubblica anche dal ramo `v3` durante lo sviluppo

Data: 2026-11-13 · Stato: superata il 13 novembre 2026 con il rilascio v1.0.0: Pages pubblica di nuovo solo da `main`

## Contesto

Il piano chiede il deploy su Pages dopo CI verde su `main` (sezione 12), ma anche una pagina di
prova pubblicata già in F0 e l'uso quotidiano da fine F3, mentre `v3` si unisce su `main` solo in
F9. L'app resta statica e senza server: Cloudflare (usato dalla v2 per il proxy dell'IA) non serve.

## Decisione

Il workflow `pages.yml` pubblica dopo CI verde su `main` **o** su `v3`. Il sito su
`https://krishnapilato.github.io/vector/` mostra quindi la v3 in costruzione al posto della v2.

## Conseguenze

- Nelle impostazioni del repository, l'ambiente `github-pages` deve permettere il ramo `v3`
  (Settings → Environments → github-pages → Deployment branches).
- Dopo F9 si toglie `v3` dal workflow.
