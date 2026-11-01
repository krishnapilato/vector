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
  ].join('\n')
}
