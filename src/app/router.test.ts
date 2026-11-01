import { describe, expect, it } from 'vitest'
import { hrefFor, parseRoute, type Route } from './router'

describe('router', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'study', subjectId: null, early: false },
      { name: 'study', subjectId: 'met', early: true },
      { name: 'subjects', subjectId: null },
      { name: 'subjects', subjectId: 'pof' },
      { name: 'settings' },
      { name: 'plan' },
      { name: 'tools', tool: null },
      { name: 'tools', tool: 'vento' },
      { name: 'pomodoro' },
      { name: 'library' },
      { name: 'profile' },
      { name: 'reader', bookId: 'abc', page: null, view: 'text' },
      { name: 'reader', bookId: 'abc', page: 12, view: 'page' },
    ]
    for (const r of routes) expect(parseRoute(hrefFor(r))).toEqual(r)
  })

  it('falls back to home', () => {
    expect(parseRoute('#/sconosciuta')).toEqual({ name: 'home' })
    expect(parseRoute('')).toEqual({ name: 'home' })
  })
})
