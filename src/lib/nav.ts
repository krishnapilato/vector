/** Links inside the app, under the GitHub Pages base path. */
const base = import.meta.env.BASE_URL

export type Route = '' | 'logbook' | 'settings'

export function href(route: Route): string {
  return `${base}${route}`
}
