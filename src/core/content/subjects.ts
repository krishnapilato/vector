import type { Subject } from './types'

/** The nine theory subjects of the EASA PPL(A) syllabus (Part-FCL, AMC1 FCL.210). */
export const easaPplSubjects: readonly Subject[] = [
  { id: 'law', name: 'Diritto aeronautico' },
  { id: 'hpl', name: 'Prestazioni e limitazioni umane' },
  { id: 'met', name: 'Meteorologia' },
  { id: 'com', name: 'Comunicazioni' },
  { id: 'pof', name: 'Principi del volo' },
  { id: 'ops', name: 'Procedure operative' },
  { id: 'fpp', name: 'Prestazioni e pianificazione' },
  { id: 'agk', name: 'Conoscenza generale dell’aeromobile' },
  { id: 'nav', name: 'Navigazione' },
]
