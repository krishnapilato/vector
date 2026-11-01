import * as z from 'zod/mini'

/**
 * Calls the Gemini API directly from the browser with the learner's own key.
 * The key lives only in this device's IndexedDB: it is never in the code,
 * never in the repository and never in exported backups.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export { DEFAULT_MODEL } from './model'

export class AiError extends Error {}

const generateResponse = z.object({
  candidates: z
    .array(
      z.object({
        content: z.optional(
          z.object({ parts: z.array(z.object({ text: z.optional(z.string()) })) }),
        ),
      }),
    )
    .check(z.minLength(1)),
})

const modelsResponse = z.object({
  models: z._default(
    z.array(
      z.object({
        name: z.string(),
        supportedGenerationMethods: z.optional(z.array(z.string())),
      }),
    ),
    [],
  ),
})

function explainStatus(status: number): string {
  if (status === 400 || status === 401 || status === 403)
    return 'Chiave non valida o non autorizzata.'
  if (status === 404) return 'Modello non trovato: scegline un altro nelle impostazioni.'
  if (status === 429) return 'Limite gratuito raggiunto per ora: riprova più tardi.'
  return `Il servizio ha risposto con un errore (${status}).`
}

async function call(url: string, apiKey: string, init: RequestInit = {}): Promise<unknown> {
  if (!navigator.onLine) throw new AiError('Sei offline: questa funzione richiede la rete.')
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    })
  } catch {
    throw new AiError('Non riesco a raggiungere il servizio. Controlla la connessione.')
  }
  if (!res.ok) throw new AiError(explainStatus(res.status))
  return res.json()
}

export async function generate(
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  }
  const json = await call(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, apiKey, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
  const parsed = generateResponse.safeParse(json)
  const text = parsed.success
    ? parsed.data.candidates[0]?.content?.parts
        .map((p) => p.text ?? '')
        .join('')
        .trim()
    : ''
  if (!text) throw new AiError('Risposta vuota: riprova.')
  return text
}

/** Lists the models this key can use for text generation; also validates the key. */
export async function listModels(apiKey: string): Promise<string[]> {
  const json = await call(`${BASE}/models?pageSize=200`, apiKey)
  return modelsResponse
    .parse(json)
    .models.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort()
}
