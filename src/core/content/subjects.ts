import { msg } from '../i18n'
import type { Subject } from './types'

/** The nine theory subjects of the EASA PPL(A) syllabus (Part-FCL, AMC1 FCL.210). */
export const easaPplSubjects: readonly Subject[] = [
  { id: 'law', name: msg('Diritto aeronautico') },
  { id: 'hpl', name: msg('Prestazioni e limitazioni umane') },
  { id: 'met', name: msg('Meteorologia') },
  { id: 'com', name: msg('Comunicazioni') },
  { id: 'pof', name: msg('Principi del volo') },
  { id: 'ops', name: msg('Procedure operative') },
  { id: 'fpp', name: msg('Prestazioni e pianificazione') },
  { id: 'agk', name: msg('Conoscenza generale dell’aeromobile') },
  { id: 'nav', name: msg('Navigazione') },
]
