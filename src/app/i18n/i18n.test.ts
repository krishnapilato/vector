import { describe, expect, it } from 'vitest'
import { collectKeys } from '../../../scripts/i18n-keys.mjs'
import { en } from './en'
import { language, loadLanguage, t, tn } from './index'

describe('i18n', () => {
  it('has an English translation for every message in the code', () => {
    const keys = collectKeys('src')
    const missing = [...keys].filter(([k]) => k && !(k in en)).map(([k, where]) => `${where}: ${k}`)
    expect(missing).toEqual([])
  })

  it('keeps the same placeholders in every translation', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const broken = Object.entries(en).filter(([it, eng]) => vars(it).join() !== vars(eng).join())
    expect(broken).toEqual([])
  })

  it('translates, fills variables and picks plurals', async () => {
    await loadLanguage('en')
    expect(language()).toBe('en')
    expect(t('Studia')).toBe('Study')
    expect(t('Pagina {page} del PDF originale', { page: 3 })).toBe('Page 3 of the original PDF')
    expect(tn(1, '{n} errore', '{n} errori')).toBe('1 mistake')
    expect(tn(2, '{n} errore', '{n} errori')).toBe('2 mistakes')
    expect(t('Testo che non esiste')).toBe('Testo che non esiste')
    await loadLanguage('it')
    expect(t('Studia')).toBe('Studia')
    expect(t('Pagina {page} del PDF originale', { page: 3 })).toBe('Pagina 3 del PDF originale')
  })
})
