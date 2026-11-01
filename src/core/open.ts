/**
 * Open questions: explain a concept in your own words. Correction is guided:
 * instead of the full answer, the learner gets a hint on what is missing and
 * tries again. Without AI, the learner checks the key points honestly.
 */

import { type ExamContext, languageName, pplExam, tutor, writeIn } from './ai/exam'
import { extractJson } from './ai/questions'
import type { Concept } from './content/types'
import type { Graded } from './grading'
import { italian, msg, type Tr } from './i18n'
import { pick, type Rng } from './random'

/** Key points of a concept: written ones, or the sentences of its source text. */
export function keyPointsFor(concept: Pick<Concept, 'source' | 'keyPoints'>): string[] {
  if (concept.keyPoints && concept.keyPoints.length > 0) return [...concept.keyPoints]
  return concept.source
    .split(/(?<=[.;:!?])\s+(?=[A-ZÀ-Ý0-9])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
    .slice(0, 4)
}

const prompts = [
  msg('Spiega con parole tue: {topic}.'),
  msg('Come lo spiegheresti a un compagno di corso? {topic}.'),
  msg('Cosa devi sapere, e perché, su: {topic}?'),
  msg('Racconta {topic} come se fossi l’istruttore.'),
]

export function openPrompt(title: string, rng: Rng, tr: Tr = italian): string {
  return tr(pick(rng, prompts), { topic: title.replace(/[.?!]+$/, '') })
}

export interface OpenFeedback {
  /** One entry per key point, in order. */
  covered: boolean[]
  /** Things the learner said that are wrong. */
  mistakes: string[]
  /** A guiding question about the first missing point, without giving the answer away. */
  hint: string | null
}

export function buildOpenPrompt(i: {
  title: string
  source: string
  keyPoints: readonly string[]
  answer: string
  round: number
  exam?: ExamContext
}): string {
  const exam = i.exam ?? pplExam
  return [
    `${tutor(exam)} Correggi la spiegazione a parole dello studente.`,
    `- ${writeIn(exam)}`,
    'Valuta la risposta SOLO rispetto ai punti chiave e al testo di riferimento. Non premiare la forma, solo la sostanza: parole diverse dal testo vanno benissimo se il significato è giusto.',
    'Regole:',
    '- "covered": per ogni punto chiave, in ordine, true se la risposta lo esprime correttamente.',
    '- "mistakes": affermazioni sbagliate presenti nella risposta (massimo 3, frasi brevi). Nessuna se non ce ne sono.',
    `- "hint": se manca qualcosa, UNA domanda guida in ${languageName(exam)} che porti lo studente a ragionare sul primo punto mancante, SENZA dare la risposta. ${i.round > 1 ? 'È già il secondo tentativo: la domanda può essere più diretta.' : ''} null se è tutto coperto.`,
    'Rispondi solo con JSON: {"covered":[true],"mistakes":[""],"hint":""}',
    '',
    `Concetto: ${i.title}`,
    `Testo di riferimento: ${i.source}`,
    'Punti chiave:',
    ...i.keyPoints.map((k, n) => `${n + 1}. ${k}`),
    '',
    `Risposta dello studente: ${i.answer.slice(0, 4000)}`,
  ].join('\n')
}

export function parseOpenFeedback(raw: string, points: number): OpenFeedback {
  const json = extractJson(raw) as Record<string, unknown>
  const covered = Array.isArray(json.covered) ? json.covered.map((c) => c === true) : []
  if (covered.length !== points) throw new Error('Valutazione incompleta: riprova.')
  const mistakes = Array.isArray(json.mistakes)
    ? json.mistakes
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim())
        .slice(0, 3)
    : []
  const hint =
    typeof json.hint === 'string' && json.hint.trim() && covered.includes(false)
      ? json.hint.trim()
      : null
  return { covered, mistakes, hint }
}

/** Points covered at least once across rounds. */
export function mergeCovered(rounds: readonly boolean[][]): boolean[] {
  const n = Math.max(0, ...rounds.map((r) => r.length))
  return Array.from({ length: n }, (_, i) => rounds.some((r) => r[i] === true))
}

/**
 * Everything at the first try: known. Everything after a hint: known, but shaky.
 * Anything still missing, or a wrong statement left in: not known yet.
 */
export function gradeOpen(rounds: readonly boolean[][], mistakesLeft: number): Graded {
  const all = mergeCovered(rounds)
  const complete = all.length > 0 && all.every(Boolean) && mistakesLeft === 0
  if (!complete) return { verdict: 'wrong', rating: 1, counts: false }
  if (rounds.length === 1) return { verdict: 'solid', rating: 3, counts: true }
  return { verdict: 'shaky', rating: 2, counts: true }
}

/** Concepts to explain: due or weak ones first, never the same twice in a row. */
export function pickOpenConcept(
  concepts: readonly Concept[],
  weight: (c: Concept) => number,
  lastId: string | null,
  rng: Rng,
): Concept | null {
  const pool = concepts.filter((c) => c.id !== lastId && keyPointsFor(c).length > 0)
  if (pool.length === 0) return concepts[0] ?? null
  const total = pool.reduce((n, c) => n + weight(c), 0)
  let r = rng() * total
  for (const c of pool) {
    r -= weight(c)
    if (r <= 0) return c
  }
  return pool[pool.length - 1] ?? null
}
