/**
 * Prompts are built here, in pure code, so they can be tested and reviewed.
 * The AI receives only the concept, its source text and the type of mistake:
 * never personal data, never anything from the camera or microphone.
 */

import { type ExamContext, languageName, pplExam, tutor } from './exam'

export interface ExplainInput {
  conceptTitle: string
  source: string
  question: string
  correctAnswer: string
  chosenAnswer: string | null
  /** Plain-language description of what went wrong. */
  mistake: string
  /** Neutral study-pattern notes from the learner profile, to adapt the style. */
  hints?: readonly string[]
  exam?: ExamContext
}

export function buildExplainPrompt(i: ExplainInput): string {
  return [
    tutor(i.exam ?? pplExam),
    'Spiega di nuovo il concetto qui sotto in modo DIVERSO dalla spiegazione del testo: usa un’analogia concreta o un piccolo esempio pratico di volo.',
    'Regole:',
    '- Usa solo le informazioni del testo di riferimento. Se non bastano, dillo invece di inventare.',
    `- Massimo 120 parole, in ${languageName(i.exam ?? pplExam)}, frasi brevi, nessun elenco puntato, nessun titolo.`,
    '- Chiudi con una domanda di verifica a cui lo studente possa rispondere tra sé.',
    '',
    `Concetto: ${i.conceptTitle}`,
    `Testo di riferimento: ${i.source}`,
    `Domanda: ${i.question}`,
    `Risposta corretta: ${i.correctAnswer}`,
    `Risposta dello studente: ${i.chosenAnswer ?? 'nessuna (non lo sapeva)'}`,
    `Problema: ${i.mistake}`,
    ...(i.hints && i.hints.length > 0
      ? ['', 'Come studia (usalo solo per adattare lo stile):', ...i.hints.map((h) => `- ${h}`)]
      : []),
  ].join('\n')
}

/** Meaning of a word or phrase in the exact sentence where the learner met it. */
export function buildContextPrompt(
  term: string,
  context: string,
  language: 'it' | 'en',
  exam: ExamContext = pplExam,
): string {
  const foreign = language !== exam.language
  return [
    `${tutor(exam)} Lo studente sta leggendo un testo${language === 'en' ? ' in inglese' : ' in italiano'} e non capisce un termine.`,
    `Spiega in ${languageName(exam)}, in massimo 80 parole, cosa significa il termine IN QUESTA FRASE${exam.aviation ? ', nel contesto aeronautico' : ''}.`,
    foreign
      ? `Indica anche il termine corrispondente in ${languageName(exam)} usato all’esame.`
      : '',
    'Non inventare: se il contesto non basta, dillo.',
    '',
    `Termine: ${term}`,
    `Frase: ${context}`,
  ]
    .filter(Boolean)
    .join('\n')
}
