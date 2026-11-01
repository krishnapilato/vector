import type { QuestionKind } from '../question-timer'
import { type ExamContext, pplExam, tutor, writeIn } from './exam'

/**
 * Question generation from the learner's own material.
 * The prompt is grounded in the text; the reply is validated strictly and
 * anything malformed is dropped, never "fixed" by guessing.
 */

export interface GeneratedVariant {
  id: string
  kind: QuestionKind
  prompt: string
  answer: string
  distractors: string[]
  explanation: string
}

export interface UserConcept {
  id: string
  subjectId: string
  title: string
  source: string
  variants: GeneratedVariant[]
  why?: { correct: string; wrong: string[] }
  origin: { bookId: string; bookTitle: string; fromPage: number; toPage: number; createdAt: string }
  /** Explanations of open questions and model answers, used by v1.1 open questions. */
  keyPoints?: string[]
}

export interface QuestionsPromptInput {
  bookTitle: string
  fromPage: number
  toPage: number
  text: string
  subjects: readonly { id: string; name: string }[]
  count: number
  language: 'it' | 'en'
  exam?: ExamContext
}

/** Keeps the prompt within the free tier's comfortable size. */
export const MAX_SOURCE_CHARS = 24_000

export function buildQuestionsPrompt(i: QuestionsPromptInput): string {
  const text = i.text.length > MAX_SOURCE_CHARS ? i.text.slice(0, MAX_SOURCE_CHARS) : i.text
  return [
    tutor(i.exam ?? pplExam),
    `Dal testo qui sotto (${i.bookTitle}, pagine ${i.fromPage}–${i.toPage}) estrai al massimo ${i.count} concetti importanti per l’esame e, per ciascuno, scrivi domande che verifichino la COMPRENSIONE, non la memoria.`,
    'Regole:',
    '- Usa SOLO informazioni presenti nel testo. Non aggiungere numeri o regole che il testo non contiene.',
    `- ${writeIn(i.exam ?? pplExam)}` +
      (i.language !== (i.exam ?? pplExam).language
        ? ' Il testo è in un’altra lingua: la prima volta che usi un termine tecnico, metti il termine originale tra parentesi.'
        : ''),
    '- Per ogni concetto 3 formulazioni diverse: una di richiamo ("recall"), una di ragionamento o scenario ("reasoning"), una formulata al contrario o in altro modo.',
    '- Ogni domanda ha una risposta corretta e almeno 4 distrattori plausibili, distinti tra loro e dalla risposta.',
    '- "source" è un breve passo (massimo 80 parole) parafrasato fedelmente dal testo, da mostrare dopo un errore.',
    '- "why" chiede il perché della risposta: una motivazione corretta e 3 sbagliate ma plausibili.',
    '- "keyPoints": da 2 a 4 punti che una buona spiegazione a parole del concetto deve contenere.',
    `- "subjectId" è uno di: ${i.subjects.map((s) => `${s.id} (${s.name})`).join(', ')}.`,
    'Rispondi solo con JSON in questo formato:',
    '{"concepts":[{"title":"","subjectId":"","source":"","keyPoints":[""],"why":{"correct":"","wrong":["","",""]},"variants":[{"kind":"recall","prompt":"","answer":"","distractors":["","","",""],"explanation":""}]}]}',
    '',
    'TESTO:',
    text,
  ].join('\n')
}

const str = (v: unknown, max = 2000): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : null

const strs = (v: unknown, max = 600): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter((x): x is string => x !== null) : []

/** Strips ``` fences and finds the outermost JSON object. */
export function extractJson(raw: string): unknown {
  const fenced = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Nessun JSON nella risposta.')
  return JSON.parse(fenced.slice(start, end + 1))
}

export interface ParseResult {
  concepts: UserConcept[]
  rejected: number
}

export function parseGenerated(
  json: unknown,
  ctx: {
    subjects: readonly { id: string }[]
    fallbackSubjectId: string
    origin: UserConcept['origin']
    makeId: () => string
  },
): ParseResult {
  const raw = (json as { concepts?: unknown } | null)?.concepts
  if (!Array.isArray(raw)) return { concepts: [], rejected: 0 }
  const kinds: QuestionKind[] = ['recall', 'reasoning', 'calculation', 'open']
  const concepts: UserConcept[] = []
  let rejected = 0

  for (const c of raw as Record<string, unknown>[]) {
    const title = str(c?.title, 200)
    const source = str(c?.source, 1500)
    const variants: GeneratedVariant[] = []
    for (const v of Array.isArray(c?.variants) ? (c.variants as Record<string, unknown>[]) : []) {
      const prompt = str(v?.prompt, 600)
      const answer = str(v?.answer, 300)
      const explanation = str(v?.explanation, 1200)
      const kind = kinds.includes(v?.kind as QuestionKind) ? (v.kind as QuestionKind) : 'recall'
      const seen = new Set(answer ? [answer.toLowerCase()] : [])
      const distractors = strs(v?.distractors, 300).filter((d) => {
        const k = d.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      if (prompt && answer && explanation && distractors.length >= 3) {
        variants.push({
          id: ctx.makeId(),
          kind: kind === 'calculation' ? 'reasoning' : kind,
          prompt,
          answer,
          distractors,
          explanation,
        })
      } else {
        rejected++
      }
    }
    if (!title || !source || variants.length === 0) {
      rejected++
      continue
    }
    const subjectId = ctx.subjects.some((s) => s.id === c.subjectId)
      ? (c.subjectId as string)
      : ctx.fallbackSubjectId
    const whyRaw = c.why as Record<string, unknown> | undefined
    const whyCorrect = str(whyRaw?.correct, 400)
    const whyWrong = strs(whyRaw?.wrong, 400)
    const keyPoints = strs(c.keyPoints, 300).slice(0, 6)
    concepts.push({
      id: ctx.makeId(),
      subjectId,
      title,
      source,
      variants,
      ...(whyCorrect && whyWrong.length >= 2
        ? { why: { correct: whyCorrect, wrong: whyWrong } }
        : {}),
      ...(keyPoints.length > 0 ? { keyPoints } : {}),
      origin: ctx.origin,
    })
  }
  return { concepts, rejected }
}
