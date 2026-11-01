import { describe, expect, it } from 'vitest'
import { buildExplainPrompt } from './prompt'

describe('buildExplainPrompt', () => {
  const input = {
    conceptTitle: 'Distanze dichiarate',
    source: 'ASDA = TORA + stopway.',
    question: "L'ASDA è uguale a:",
    correctAnswer: 'TORA + stopway',
    chosenAnswer: 'TORA + clearway',
    mistake: 'Risposta sbagliata.',
  }

  it('grounds the answer in the source and the mistake', () => {
    const p = buildExplainPrompt(input)
    expect(p).toContain('ASDA = TORA + stopway.')
    expect(p).toContain('TORA + clearway')
    expect(p).toContain('Usa solo le informazioni del testo')
  })

  it('handles "I don\'t know"', () => {
    expect(buildExplainPrompt({ ...input, chosenAnswer: null })).toContain('non lo sapeva')
  })
})
