import { describe, expect, it } from 'vitest'
import { buildQuestionsPrompt, extractJson, MAX_SOURCE_CHARS, parseGenerated } from './ai/questions'
import { buildCourse } from './content/course'
import { lookup } from './content/glossary'
import { pplSample } from './content/ppl-sample'
import { buildQuestion } from './content/question'
import { createRng } from './random'
import {
  chapterOf,
  chaptersFromOutline,
  normalizeSelection,
  readingProgress,
  segments,
} from './reading/book'
import { itemsToText, paragraphs, searchPages, type TextItem } from './reading/text'

const item = (
  str: string,
  x: number,
  y: number,
  width = str.length * 5,
  height = 10,
): TextItem => ({ str, x, y, width, height })

describe('PDF text', () => {
  it('orders lines, joins words, de-hyphenates and splits paragraphs', () => {
    const text = itemsToText([
      item('12', 300, 20), // page number at the bottom
      item('The angle of', 50, 700),
      item('attack is mea-', 115, 700),
      item('sured from the chord.', 50, 688),
      item('Second paragraph.', 50, 640),
      item('Title', 50, 760),
    ])
    expect(text).toBe(
      'Title\n\nThe angle of attack is measured from the chord.\n\nSecond paragraph.',
    )
  })

  it('keeps hyphens that are real and handles empty pages', () => {
    expect(itemsToText([item('pre-', 0, 100), item('Flight check', 0, 88)])).toBe(
      'pre- Flight check',
    )
    expect(itemsToText([])).toBe('')
    expect(itemsToText([item('3', 0, 10)])).toBe('')
  })

  it('maps paragraphs to offsets', () => {
    const t = 'Uno.\n\nDue due.\n\nTre.'
    const ps = paragraphs(t)
    expect(ps.map((p) => t.slice(p.start, p.start + p.text.length))).toEqual([
      'Uno.',
      'Due due.',
      'Tre.',
    ])
  })

  it('searches without caring about case or accents', () => {
    const hits = searchPages(
      [{ page: 3, text: 'La Quota densità sale. quota densita di nuovo.' }],
      'QUOTA DENSITA',
    )
    expect(hits).toHaveLength(2)
    expect(hits[0]).toMatchObject({ page: 3, match: 'Quota densità' })
    expect(searchPages([], 'x')).toEqual([])
    expect(searchPages([{ page: 1, text: 'abababab' }], 'ab', 2)).toHaveLength(2)
  })
})

describe('chapters', () => {
  it('builds chapters from the outline', () => {
    const ch = chaptersFromOutline(
      [
        { title: 'Meteorologia', page: 40 },
        { title: ' Principi  del volo ', page: 5 },
        { title: 'Doppio', page: 5 },
        { title: 'Fuori', page: 999 },
      ],
      80,
    )
    expect(ch).toEqual([
      { title: 'Inizio', startPage: 1, endPage: 4 },
      { title: 'Principi del volo', startPage: 5, endPage: 39 },
      { title: 'Meteorologia', startPage: 40, endPage: 80 },
    ])
    expect(chapterOf({ chapters: ch }, 41)?.title).toBe('Meteorologia')
    expect(chapterOf({ chapters: ch }, 100)).toBeNull()
  })

  it('falls back to page groups', () => {
    expect(chaptersFromOutline([], 45).map((c) => c.title)).toEqual([
      'Pagine 1–20',
      'Pagine 21–40',
      'Pagine 41–45',
    ])
    expect(readingProgress({ readPages: [1, 2, 2], pageCount: 4 })).toBe(0.5)
    expect(readingProgress({ readPages: [], pageCount: 0 })).toBe(0)
  })
})

describe('highlights', () => {
  const text = 'Il vento relativo è opposto alla traiettoria.'
  it('trims selections', () => {
    expect(normalizeSelection(text, 18, 2)).toEqual({ start: 3, end: 17, quote: 'vento relativo' })
    expect(normalizeSelection(text, 2, 3)).toBeNull()
  })
  it('splits text into runs by highlight', () => {
    const s = segments(text, 0, text.length, [
      { id: 'a', start: 3, end: 17 },
      { id: 'b', start: 9, end: 25 },
    ])
    expect(s.map((x) => [x.text, x.highlightIds])).toEqual([
      ['Il ', []],
      ['vento ', ['a']],
      ['relativo', ['a', 'b']],
      [' è oppos', ['b']],
      ['to alla traiettoria.', []],
    ])
  })
})

describe('glossary', () => {
  it('finds terms in both languages and by abbreviation', () => {
    expect(lookup('Angolo d’attacco')[0]?.en).toBe('angle of attack')
    expect(lookup('stall')[0]?.it).toBe('stallo')
    expect(lookup('tas')[0]?.it).toBe('velocità vera')
    expect(lookup('QNH.')[0]?.abbr).toBe('QNH')
    expect(lookup('drag').map((e) => e.it)).toContain('resistenza indotta')
    expect(lookup('  ')).toEqual([])
    expect(lookup('xx')).toEqual([])
  })
})

describe('AI questions', () => {
  const origin = { bookId: 'b', bookTitle: 'PHAK', fromPage: 1, toPage: 2, createdAt: 'x' }
  let n = 0
  const ctx = {
    subjects: [{ id: 'pof' }, { id: 'met' }],
    fallbackSubjectId: 'pof',
    origin,
    makeId: () => `id${n++}`,
  }
  const variant = {
    kind: 'reasoning',
    prompt: 'Q?',
    answer: 'A',
    distractors: ['B', 'C', 'D', 'A', 'b', 'B'],
    explanation: 'Because.',
  }

  it('builds a grounded prompt and truncates long text', () => {
    const p = buildQuestionsPrompt({
      bookTitle: 'PHAK',
      fromPage: 1,
      toPage: 2,
      text: 'x'.repeat(MAX_SOURCE_CHARS + 10),
      subjects: [{ id: 'pof', name: 'Principi' }],
      count: 3,
      language: 'en',
    })
    expect(p).toContain('Usa SOLO informazioni presenti nel testo')
    expect(p).toContain('termine originale tra parentesi')
    expect(p.length).toBeLessThan(MAX_SOURCE_CHARS + 3000)
  })

  it('extracts JSON from fenced replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(() => extractJson('nothing')).toThrow()
  })

  it('keeps valid concepts and drops malformed ones', () => {
    const r = parseGenerated(
      {
        concepts: [
          {
            title: 'Stallo',
            subjectId: 'met',
            source: 'Testo.',
            keyPoints: ['uno', 2],
            why: { correct: 'ok', wrong: ['x', 'y'] },
            variants: [
              variant,
              { ...variant, distractors: ['A', 'B'] },
              { ...variant, kind: 'calculation' },
            ],
          },
          { title: 'Senza varianti', source: 'Testo.', variants: [] },
          {
            title: 'Materia ignota',
            subjectId: 'zzz',
            source: 'T.',
            variants: [{ ...variant, kind: 'weird' }],
          },
          null,
        ],
      },
      ctx,
    )
    expect(r.concepts).toHaveLength(2)
    expect(r.rejected).toBe(3)
    const [first, second] = r.concepts
    expect(first?.subjectId).toBe('met')
    expect(first?.variants[0]?.distractors).toEqual(['B', 'C', 'D'])
    expect(first?.variants[1]?.kind).toBe('reasoning')
    expect(first?.keyPoints).toEqual(['uno'])
    expect(first?.why?.wrong).toEqual(['x', 'y'])
    expect(second?.subjectId).toBe('pof')
    expect(second?.variants[0]?.kind).toBe('recall')
    expect(parseGenerated({}, ctx).concepts).toEqual([])
  })

  it('merges generated concepts into a studyable course', () => {
    const [concept] = parseGenerated(
      { concepts: [{ title: 'T', source: 'S', variants: [variant] }] },
      ctx,
    ).concepts
    if (!concept) throw new Error('none')
    const course = buildCourse(pplSample, [concept], false)
    expect(course.subjects).toHaveLength(9)
    expect(course.concepts).toHaveLength(1)
    const q = buildQuestion(
      course.concepts[0] as never,
      course.concepts[0]?.variants[0] as never,
      createRng(1),
      false,
    )
    expect(q.options).toHaveLength(4)
    expect(buildCourse(pplSample, [], true).concepts.length).toBe(pplSample.concepts.length)
  })
})
