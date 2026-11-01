import { describe, expect, it } from 'vitest'
import { buildContextPrompt, buildExplainPrompt } from './prompt'

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

  it('adds study-pattern hints only when present', () => {
    expect(buildExplainPrompt(input)).not.toContain('Come studia')
    expect(buildExplainPrompt({ ...input, hints: ['Parti da un esempio.'] })).toContain(
      '- Parti da un esempio.',
    )
  })

  it('handles "I don\'t know"', () => {
    expect(buildExplainPrompt({ ...input, chosenAnswer: null })).toContain('non lo sapeva')
  })
})

describe('buildContextPrompt', () => {
  it('asks for the Italian exam term when reading English', () => {
    expect(buildContextPrompt('stall', 'The wing will stall.', 'en')).toContain('termine italiano')
    expect(buildContextPrompt('stallo', 'L’ala stalla.', 'it')).not.toContain('termine italiano')
  })
})
