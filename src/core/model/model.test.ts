import { describe, expect, it } from 'vitest'
import exercises from '../../content/exercises.json'
import sim from '../../content/sim-lessons.json'
import trebbi from '../../content/trebbi.json'
import { parseContent, TrebbiFile } from './content'
import { defaultSettings } from './defaults'
import { Chapter, Settings } from './schemas'
import { subjectFromFile, subjectName, subjects } from './subjects'

describe('starting content', () => {
  it('is valid and maps to the model', () => {
    const content = parseContent(trebbi, exercises, sim)
    expect(content.chapters.length).toBeGreaterThan(0)
    for (const c of content.chapters) expect(Chapter.safeParse(c).success).toBe(true)
    expect(content.chapters.map((c) => c.order)).toEqual(
      content.chapters.map((c) => c.order).toSorted((a, b) => a - b),
    )
    expect(content.simLessons[0]?.status).toBe('not-started')
  })

  it('rejects a chapter that ends before it starts', () => {
    const bad = {
      edizione: 'x',
      capitoli: [
        {
          id: 'c',
          ordine: 1,
          titolo: 't',
          materia: 'meteorologia',
          paginaInizio: 20,
          paginaFine: 10,
          difficolta: 2,
        },
      ],
    }
    expect(TrebbiFile.safeParse(bad).success).toBe(false)
  })

  it('rejects duplicate chapter ids and unknown subjects', () => {
    const chapter = {
      id: 'c',
      ordine: 1,
      titolo: 't',
      materia: 'meteorologia',
      paginaInizio: 1,
      paginaFine: 10,
      difficolta: 2,
    }
    expect(TrebbiFile.safeParse({ edizione: '', capitoli: [chapter, chapter] }).success).toBe(false)
    expect(
      TrebbiFile.safeParse({ edizione: '', capitoli: [{ ...chapter, materia: 'astrologia' }] })
        .success,
    ).toBe(false)
  })
})

describe('subjects and settings', () => {
  it('names the nine EASA subjects in English', () => {
    expect(subjects).toHaveLength(9)
    expect(subjectName(subjectFromFile('principi-del-volo'))).toBe('Principles of Flight')
  })

  it('starts from valid default settings', () => {
    const s = defaultSettings()
    expect(Settings.safeParse(s).success).toBe(true)
    expect(s.split.book + s.split.exercises + s.split.simulator).toBeCloseTo(1)
  })
})
