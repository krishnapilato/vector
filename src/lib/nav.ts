/** Links inside the app, under the GitHub Pages base path. */
const base = import.meta.env.BASE_URL

export type Route =
  | ''
  | 'session'
  | 'session/end'
  | 'plan'
  | 'week'
  | 'logbook'
  | 'milestones'
  | 'materials'
  | 'settings'
  | 'settings/privacy'
  | 'welcome'

export function href(route: Route): string {
  return `${base}${route}`
}

export function go(route: Route): void {
  window.location.assign(href(route))
}
