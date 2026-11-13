/** The nine EASA PPL(A) theory subjects, with the English names used in the interface. */
export const subjects = [
  { id: 'air-law', name: 'Air Law', file: 'diritto-aeronautico' },
  {
    id: 'human-performance',
    name: 'Human Performance and Limitations',
    file: 'prestazioni-umane',
  },
  { id: 'meteorology', name: 'Meteorology', file: 'meteorologia' },
  { id: 'communications', name: 'Communications', file: 'comunicazioni' },
  { id: 'principles-of-flight', name: 'Principles of Flight', file: 'principi-del-volo' },
  { id: 'operational-procedures', name: 'Operational Procedures', file: 'procedure-operative' },
  {
    id: 'flight-performance-planning',
    name: 'Flight Performance and Planning',
    file: 'prestazioni-e-pianificazione',
  },
  {
    id: 'aircraft-general-knowledge',
    name: 'Aircraft General Knowledge',
    file: 'conoscenza-generale-aeromobile',
  },
  { id: 'navigation', name: 'Navigation', file: 'navigazione' },
] as const

export type SubjectId = (typeof subjects)[number]['id']

/** Italian slugs as written by hand in src/content/*.json (PIANO-V3 §16). */
export type SubjectFileId = (typeof subjects)[number]['file']

export const subjectIds = subjects.map((s) => s.id) as [SubjectId, ...SubjectId[]]
export const subjectFileIds = subjects.map((s) => s.file) as [SubjectFileId, ...SubjectFileId[]]

export function subjectName(id: SubjectId): string {
  return subjects.find((s) => s.id === id)?.name ?? id
}

export function subjectFromFile(file: SubjectFileId): SubjectId {
  const found = subjects.find((s) => s.file === file)
  if (!found) throw new Error(`Unknown subject: ${file}`)
  return found.id
}
