# Server di sincronizzazione (facoltativo)

Vector funziona senza server. Questo Worker serve solo per tenere allineati più dispositivi
(computer e telefono). Riceve e conserva **solo dati cifrati sul tuo dispositivo** con la tua
frase segreta (AES-GCM 256, chiave da PBKDF2-SHA256 con 600.000 iterazioni): chi gestisce il
server, te compreso, non può leggerli.

Il piano gratuito di Cloudflare Workers + KV basta ampiamente.

## Pubblicazione

```sh
cd worker
npx wrangler login
npx wrangler kv namespace create VECTOR_SYNC   # copia l'id in wrangler.toml
# in wrangler.toml imposta ALLOWED_ORIGIN all'indirizzo della tua Vector
npx wrangler deploy
```

Poi in Vector: **Impostazioni → Sincronizzazione**, incolla l'indirizzo del Worker
(es. `https://vector-sync.<tuo-nome>.workers.dev`) e la stessa frase segreta su ogni dispositivo.

## Cosa vede il server

- un identificativo derivato dalla frase segreta (non reversibile);
- l'hash di un token di accesso, anch'esso derivato dalla frase;
- un blocco cifrato e il suo numero di versione.

Non vede: progressi, note, libri, impostazioni, chiave Gemini (che non viene mai sincronizzata).

## API

- `GET /v1/:id` con `Authorization: Bearer <token>` → il blocco cifrato, header `x-version`.
- `PUT /v1/:id` con `x-base-version` uguale all'ultima versione letta → nuova versione; `409` se un
  altro dispositivo ha scritto nel frattempo.
- `DELETE /v1/:id` → cancella tutto.
