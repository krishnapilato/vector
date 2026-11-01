import { type Tr, translator, type Vars } from '../../core/i18n'

export type Language = 'it' | 'en'
export const languageLabel: Record<Language, string> = { it: 'Italiano', en: 'English' }

let current: Language = 'it'
let tr: Tr = translator(null)

/**
 * Loads the dictionary (English is a separate chunk, so Italian users never download it)
 * and switches the interface language. Called once per load, before the first render;
 * changing language later reloads the app.
 */
export async function loadLanguage(lang: Language): Promise<void> {
  const dictionary = lang === 'en' ? (await import('./en')).en : null
  current = lang
  tr = translator(dictionary)
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}

export const language = () => current
export const locale = () => (current === 'en' ? 'en-GB' : 'it-IT')

/** Translate a message (written in Italian) to the interface language. */
export function t(message: string, vars?: Vars): string {
  return tr(message, vars)
}

/** Singular or plural, both written in Italian. */
export function tn(n: number, one: string, many: string, vars?: Vars): string {
  return t(n === 1 ? one : many, { n, ...vars })
}
