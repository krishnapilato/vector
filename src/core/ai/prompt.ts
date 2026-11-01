/**
 * Prompts are built here, in pure code, so they can be tested and reviewed.
 * The AI receives only the concept, its source text and the type of mistake:
 * never personal data, never anything from the camera or microphone.
 */

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
}

export function buildExplainPrompt(i: ExplainInput): string {
  return [
    'Sei un istruttore di volo che prepara uno studente all’esame teorico PPL(A) EASA.',
    'Spiega di nuovo il concetto qui sotto in modo DIVERSO dalla spiegazione del testo: usa un’analogia concreta o un piccolo esempio pratico di volo.',
    'Regole:',
    '- Usa solo le informazioni del testo di riferimento. Se non bastano, dillo invece di inventare.',
    '- Massimo 120 parole, in italiano, frasi brevi, nessun elenco puntato, nessun titolo.',
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
export function buildContextPrompt(term: string, context: string, language: 'it' | 'en'): string {
  return [
    'Sei un istruttore di volo. Uno studente PPL(A) sta leggendo un testo' +
      (language === 'en' ? ' in inglese' : '') +
      ' e non capisce un termine.',
    'Spiega in italiano, in massimo 80 parole, cosa significa il termine IN QUESTA FRASE, nel contesto aeronautico.',
    language === 'en' ? 'Indica anche il termine italiano corrispondente usato all’esame.' : '',
    'Non inventare: se il contesto non basta, dillo.',
    '',
    `Termine: ${term}`,
    `Frase: ${context}`,
  ]
    .filter(Boolean)
    .join('\n')
}
