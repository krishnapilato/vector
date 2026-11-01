import { useSyncExternalStore } from 'react'

/**
 * A tiny hash router: a handful of screens don't need a routing library.
 * Hash URLs also work on GitHub Pages and offline without server rewrites.
 */
export type Route =
  | { name: 'home' }
  | { name: 'study'; subjectId: string | null; early: boolean }
  | { name: 'subjects'; subjectId: string | null }
  | { name: 'settings' }
  | { name: 'plan' }
  | { name: 'tools'; tool: string | null }
  | { name: 'pomodoro' }
  | { name: 'library' }
  | { name: 'profile' }
  | { name: 'open'; subjectId: string | null }
  | { name: 'diary' }
  | { name: 'map'; subjectId: string | null }
  | { name: 'reader'; bookId: string; page: number | null; view: 'text' | 'page' }

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(query)
  const [first, second] = path.split('/')
  switch (first) {
    case 'studia':
      return { name: 'study', subjectId: params.get('materia'), early: params.has('anticipo') }
    case 'materie':
      return { name: 'subjects', subjectId: second || null }
    case 'impostazioni':
      return { name: 'settings' }
    case 'piano':
      return { name: 'plan' }
    case 'strumenti':
      return { name: 'tools', tool: second || null }
    case 'pomodoro':
      return { name: 'pomodoro' }
    case 'profilo':
      return { name: 'profile' }
    case 'spiega':
      return { name: 'open', subjectId: params.get('materia') }
    case 'errori':
      return { name: 'diary' }
    case 'programma':
      return { name: 'map', subjectId: second || null }
    case 'libreria': {
      if (!second) return { name: 'library' }
      const p = Number(params.get('p'))
      return {
        name: 'reader',
        bookId: second,
        page: Number.isInteger(p) && p > 0 ? p : null,
        view: params.get('vista') === 'pagina' ? 'page' : 'text',
      }
    }
    default:
      return { name: 'home' }
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'study': {
      const q = new URLSearchParams()
      if (route.subjectId) q.set('materia', route.subjectId)
      if (route.early) q.set('anticipo', '')
      const s = q.toString().replace(/=(?=&|$)/g, '')
      return s ? `#/studia?${s}` : '#/studia'
    }
    case 'subjects':
      return route.subjectId ? `#/materie/${route.subjectId}` : '#/materie'
    case 'settings':
      return '#/impostazioni'
    case 'plan':
      return '#/piano'
    case 'tools':
      return route.tool ? `#/strumenti/${route.tool}` : '#/strumenti'
    case 'pomodoro':
      return '#/pomodoro'
    case 'library':
      return '#/libreria'
    case 'profile':
      return '#/profilo'
    case 'open':
      return route.subjectId
        ? `#/spiega?materia=${encodeURIComponent(route.subjectId)}`
        : '#/spiega'
    case 'diary':
      return '#/errori'
    case 'map':
      return route.subjectId ? `#/programma/${route.subjectId}` : '#/programma'
    case 'reader': {
      const q = new URLSearchParams()
      if (route.page) q.set('p', String(route.page))
      if (route.view === 'page') q.set('vista', 'pagina')
      const s = q.toString()
      return `#/libreria/${route.bookId}${s ? `?${s}` : ''}`
    }
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route)
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
