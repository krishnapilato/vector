/** Who the AI is talking to: the exam and the language the learner studies in. */
export interface ExamContext {
  name: string
  aviation: boolean
  /** Language of everything the AI writes for the learner. */
  language: 'it' | 'en'
}

export const pplExam: ExamContext = { name: 'PPL(A) EASA', aviation: true, language: 'it' }

export const tutor = (e: ExamContext) =>
  e.aviation
    ? `Sei un istruttore di volo che prepara uno studente all’esame teorico ${e.name}.`
    : `Sei un tutor esperto che prepara uno studente all’esame «${e.name}».`

export const languageName = (e: ExamContext) => (e.language === 'en' ? 'inglese' : 'italiano')

export const writeIn = (e: ExamContext) =>
  e.language === 'en' ? 'Scrivi tutto in inglese (English).' : 'Scrivi tutto in italiano.'
