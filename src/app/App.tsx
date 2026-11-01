import { lazy, Suspense } from 'react'
import { hrefFor, type Route, useRoute } from './router'
import { Home } from './screens/Home'
import { Subjects } from './screens/Subjects'
import { StoreProvider } from './state'

// Screens beyond the home page load on demand: the startup bundle stays small.
const Study = lazy(() => import('./screens/Study').then((m) => ({ default: m.Study })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))

const nav: { label: string; route: Route }[] = [
  { label: 'Studia', route: { name: 'home' } },
  { label: 'Materie', route: { name: 'subjects', subjectId: null } },
  { label: 'Impostazioni', route: { name: 'settings' } },
]

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const route = useRoute()

  // Study state: no menu, no footer. Only the question on screen.
  if (route.name === 'study') {
    return (
      <Suspense fallback={null}>
        <Study key={hrefFor(route)} subjectId={route.subjectId} early={route.early} />
      </Suspense>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <a href="#/" className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="24" cy="76" r="11" fill="currentColor" />
            <line x1="42" y1="58" x2="84" y2="16" stroke="currentColor" strokeWidth="15" />
          </svg>
          vector
        </a>
        <nav aria-label="Principale">
          <ul className="flex gap-1">
            {nav.map((item) => {
              const current = item.route.name === route.name
              return (
                <li key={item.label}>
                  <a
                    href={hrefFor(item.route)}
                    aria-current={current ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${
                      current
                        ? 'text-[var(--fg)] underline underline-offset-8'
                        : 'text-[var(--fg-quiet)]'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      <main className="flex-1 py-10">
        {route.name === 'home' && <Home />}
        {route.name === 'subjects' && <Subjects subjectId={route.subjectId} />}
        {route.name === 'settings' && (
          <Suspense fallback={null}>
            <Settings />
          </Suspense>
        )}
      </main>

      <footer className="flex flex-wrap justify-between gap-2 py-6 text-xs text-[var(--fg-quiet)]">
        <span>vector v0.2</span>
        <span>I tuoi dati restano su questo dispositivo.</span>
      </footer>
    </div>
  )
}
