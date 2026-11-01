import { describe, expect, it } from 'vitest'
import { pickCards, review } from './cards'
import { glossary } from './content/glossary'
import {
  abbreviate,
  checkReadback,
  digits,
  freqText,
  generateScenario,
  normalize,
  scenarioKinds,
  spell,
} from './radio/phraseology'
import { createRng } from './random'
import {
  ceiling,
  describeMetar,
  describeWeather,
  metarQuestions,
  parseMetar,
  parseTaf,
  randomMetar,
  vfrHint,
} from './weather/metar'

describe('phraseology', () => {
  it('spells callsigns and numbers the ICAO way', () => {
    expect(spell('I-ABCD')).toBe('India Alfa Bravo Charlie Delta')
    expect(abbreviate('I-ABCD')).toBe('ICD')
    expect(digits('1013')).toBe('one zero one tree')
    expect(digits('118.9', true)).toBe('one one eight decimal niner')
    expect(freqText('126.750')).toBe('126.75')
    expect(freqText('122.000')).toBe('122.0')
  })

  it('normalizes spoken answers', () => {
    expect(normalize('Runway two six, QNH one zero one tree, India Charlie Delta')).toBe(
      'runway 26 qnh 1013 ICD',
    )
    expect(normalize('Squawk 4215, I-CD')).toBe('squawk 4215 i cd')
    expect(normalize('contact one two six decimal seven five')).toBe('contact 126.75')
    expect(normalize('X-ray Whisky Juliet alpha')).toBe('XWJA')
  })

  it('checks readbacks by elements, not wording', () => {
    const rng = createRng(7)
    const s = generateScenario(rng, 'taxi')
    const ex = s.exchanges[0]
    if (!ex) throw new Error('no exchange')
    expect(checkReadback(ex.model, ex.required).ok).toBe(true)
    const partial = checkReadback('roger', ex.required)
    expect(partial.ok).toBe(false)
    expect(partial.items.every((i) => !i.ok)).toBe(true)
  })

  it('does not find a runway inside a QNH', () => {
    const r = checkReadback('QNH 1026', [{ label: 'Pista 26', accept: ['26'] }])
    expect(r.ok).toBe(false)
  })

  it('generates every scenario with a valid model answer and fresh values', () => {
    const rng = createRng(11)
    for (const kind of scenarioKinds) {
      for (let i = 0; i < 5; i++) {
        const s = generateScenario(rng, kind)
        expect(s.id).toBe(kind)
        for (const ex of s.exchanges) {
          const r = checkReadback(ex.model, ex.required)
          expect(
            r.items.filter((x) => !x.ok),
            `${kind}: ${ex.model}`,
          ).toEqual([])
        }
      }
    }
    const a = generateScenario(createRng(1), 'squawk')
    const b = generateScenario(createRng(2), 'squawk')
    expect(a.exchanges[0]?.atc).not.toBe(b.exchanges[0]?.atc)
    expect(generateScenario(createRng(3)).exchanges.length).toBeGreaterThan(0)
  })
})

describe('METAR', () => {
  it('decodes a full METAR', () => {
    const m = parseMetar(
      'METAR LIMC 011050Z 27012G25KT 240V300 4000 -RA BR FEW008 BKN015CB 12/11 Q1008 BECMG 9999=',
    )
    expect(m.station).toBe('LIMC')
    expect(m.time).toEqual({ day: 1, hour: 10, minute: 50 })
    expect(m.wind).toEqual({ dir: 270, kt: 12, gust: 25, varFrom: 240, varTo: 300 })
    expect(m.visibility).toEqual({ meters: 4000 })
    expect(m.weather).toEqual(['-RA', 'BR'])
    expect(m.clouds).toEqual([
      { cover: 'FEW', feet: 800, type: null },
      { cover: 'BKN', feet: 1500, type: 'CB' },
    ])
    expect([m.temp, m.dew, m.qnh]).toEqual([12, 11, 1008])
    expect(m.trend).toBe('BECMG 9999')
    expect(ceiling(m)).toBe(1500)
    expect(vfrHint(m)).toBe('marginale')
    const text = describeMetar(m)
      .map((d) => d.value)
      .join(' | ')
    expect(text).toContain('raffiche 25')
    expect(text).toContain('cumulonembi')
    expect(text).toContain('quasi satura')
  })

  it('handles CAVOK, negative temperatures, US units, unknown groups', () => {
    const m = parseMetar('SPECI KJFK 011251Z AUTO VRB03KT 10SM CLR M05/M12 A2992 RMK AO2')
    expect(m.kind).toBe('SPECI')
    expect(m.auto).toBe(true)
    expect(m.wind?.dir).toBe('VRB')
    expect(m.visibility?.meters).toBe(16090)
    expect([m.temp, m.dew, m.qnh]).toEqual([-5, -12, 1013])
    expect(m.noCloud).toBe('CLR')
    const c = parseMetar('LIML 011020Z 00000KT CAVOK 20/05 Q1020 NOSIG XYZ')
    expect(c.cavok).toBe(true)
    expect(vfrHint(c)).toBe('VMC')
    expect(c.unknown).toEqual([])
    expect(
      describeMetar(c)
        .map((d) => d.value)
        .join(' '),
    ).toContain('calmo')
    expect(parseMetar('LIML 011020Z 0800 FG VV002 05/05 Q1020').clouds[0]).toEqual({
      cover: 'VV',
      feet: 200,
      type: null,
    })
    expect(vfrHint(parseMetar('LIML 011020Z 0800 FG VV002'))).toBe('IMC')
    expect(vfrHint(parseMetar('LIML'))).toBeNull()
    expect(parseMetar('LIML 011020Z 18005MPS 9999 FOO').wind?.kt).toBe(10)
    expect(parseMetar('LIML 011020Z 18005KT 9999 FOO').unknown).toEqual(['FOO'])
  })

  it('describes weather codes', () => {
    expect(describeWeather('+TSRA')).toBe('temporale pioggia, forte')
    expect(describeWeather('VCSH')).toBe('rovesci di, nelle vicinanze')
    expect(describeWeather('FZFG')).toBe('che gela nebbia')
  })

  it('splits a TAF into groups', () => {
    const t = parseTaf(
      'TAF LIMC 010500Z 0106/0212 27010KT 9999 SCT030 TEMPO 0112/0118 4000 TSRA BKN020CB BECMG 0200/0202 3000 BR',
    )
    expect(t.header).toBe('TAF LIMC 010500Z 0106/0212')
    expect(t.groups.map((g) => g.label)).toEqual([
      'Previsione base (validità 0106/0212)',
      'Temporaneamente 0112/0118',
      'In cambiamento 0200/0202',
    ])
    expect(t.groups[1]?.body.weather).toEqual(['TSRA'])
    expect(t.groups[2]?.body.visibility?.meters).toBe(3000)
    expect(parseTaf('FM011200 27010KT 9999').groups[0]?.label).toContain('Previsione base')
  })

  it('generates parseable METARs and questions with the right answer among the options', () => {
    const rng = createRng(5)
    for (let i = 0; i < 50; i++) {
      const raw = randomMetar(rng)
      const m = parseMetar(raw)
      expect(m.unknown, raw).toEqual([])
      for (const q of metarQuestions(m, rng)) {
        expect(q.options).toContain(q.answer)
        expect(new Set(q.options).size).toBe(q.options.length)
      }
    }
  })
})

describe('flashcards', () => {
  it('moves terms between Leitner boxes', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    const a = review(undefined, 'stall', true, now)
    expect(a.box).toBe(1)
    expect(a.due).toBe('2026-10-02T10:00:00.000Z')
    expect(review({ ...a, box: 5 }, 'stall', true, now).box).toBe(5)
    expect(review(a, 'stall', false, now)).toMatchObject({ box: 0, due: now.toISOString() })
  })

  it('picks due and often-looked-up terms first, skips those not due', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    const [first, second] = glossary
    if (!first || !second) throw new Error('glossary')
    const states = new Map([[first.en, { term: first.en, box: 2, due: '2026-12-01T00:00:00Z' }]])
    const lookups = new Map([[second.en.toLowerCase(), 5]])
    const cards = pickCards(glossary, states, lookups, now, 5, () => false)
    expect(cards).toHaveLength(5)
    expect(cards[0]?.entry).toBe(second)
    expect(cards.some((c) => c.entry === first)).toBe(false)
    expect(cards[0]?.front).toBe(second.it)
    expect(pickCards(glossary, new Map(), new Map(), now, 1, () => true)[0]?.direction).toBe(
      'en-it',
    )
  })
})

import { buildCourse, subjectId } from './content/course'
import { pplSample } from './content/ppl-sample'

describe('course templates', () => {
  const concept = {
    id: 'u1',
    subjectId: 'storia',
    title: 'T',
    source: 'S',
    variants: [],
    origin: { bookId: 'b', bookTitle: 'B', fromPage: 1, toPage: 1, createdAt: '' },
  }

  it('builds the PPL course with or without the sample', () => {
    expect(buildCourse(pplSample, [], true).concepts.length).toBe(pplSample.concepts.length)
    expect(buildCourse(pplSample, [concept], false).concepts.map((c) => c.id)).toEqual(['u1'])
  })

  it('builds a custom exam from the learner’s subjects only', () => {
    const c = buildCourse(pplSample, [concept, { ...concept, id: 'u2', subjectId: 'gone' }], true, {
      template: 'custom',
      examName: 'Esame di Stato',
      subjects: [
        { id: 'storia', name: 'Storia' },
        { id: 'arte', name: 'Arte' },
      ],
    })
    expect(c.name).toBe('Esame di Stato')
    expect(c.subjects.map((s) => s.id)).toEqual(['storia', 'arte'])
    expect(c.concepts.map((x) => x.subjectId)).toEqual(['storia', 'storia'])
    expect(
      buildCourse(pplSample, [], true, { template: 'custom', examName: 'X', subjects: [] })
        .subjects,
    ).toEqual([{ id: 'general', name: 'X' }])
  })

  it('makes subject ids', () => {
    expect(subjectId('Diritto Pubblico è', new Set())).toBe('diritto-pubblico-e')
    expect(subjectId('Storia', new Set(['storia', 'storia-2']))).toBe('storia-3')
    expect(subjectId('!!!', new Set())).toBe('materia')
  })
})
