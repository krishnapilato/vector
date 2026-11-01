import { lazy, Suspense, useEffect, useState } from 'react'
import { hrefFor, type Route, useRoute } from './router'
import { Home } from './screens/Home'
import { StoreProvider } from './state'

// Screens beyond the home page load on demand: the startup bundle stays small.
const Study = lazy(() => import('./screens/Study').then((m) => ({ default: m.Study })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))
const Subjects = lazy(() => import('./screens/Subjects').then((m) => ({ default: m.Subjects })))
const Plan = lazy(() => import('./screens/Plan').then((m) => ({ default: m.Plan })))
const Tools = lazy(() => import('./screens/Tools').then((m) => ({ default: m.Tools })))
const Library = lazy(() => import('./screens/Library').then((m) => ({ default: m.Library })))
const Reader = lazy(() => import('./screens/Reader').then((m) => ({ default: m.Reader })))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))
const OpenQuestion = lazy(() =>
  import('./screens/OpenQuestion').then((m) => ({ default: m.OpenQuestion })),
)
const Diary = lazy(() => import('./screens/Diary').then((m) => ({ default: m.Diary })))
const ProgramMap = lazy(() =>
  import('./screens/ProgramMap').then((m) => ({ default: m.ProgramMap })),
)
const PomodoroScreen = lazy(() =>
  import('./screens/PomodoroScreen').then((m) => ({ default: m.PomodoroScreen })),
)

const nav: { label: string; route: Route }[] = [
  { label: 'Studia', route: { name: 'home' } },
  { label: 'Libreria', route: { name: 'library' } },
  { label: 'Piano', route: { name: 'plan' } },
  { label: 'Strumenti', route: { name: 'tools', tool: null } },
  { label: 'Materie', route: { name: 'subjects', subjectId: null } },
  { label: 'Profilo', route: { name: 'profile' } },
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
  // Phone: the menu folds away; it closes on every navigation.
  const [menuOpen, setMenuOpen] = useState(false)
  const href = hrefFor(route)
  useEffect(() => {
    if (href) setMenuOpen(false)
  }, [href])

  // Study state: no menu, no footer.
  if (route.name === 'pomodoro') {
    return (
      <Suspense fallback={null}>
        <PomodoroScreen />
      </Suspense>
    )
  }
  if (route.name === 'open') {
    return (
      <Suspense fallback={null}>
        <OpenQuestion subjectId={route.subjectId} />
      </Suspense>
    )
  }
  if (route.name === 'reader') {
    return (
      <Suspense fallback={null}>
        <Reader bookId={route.bookId} page={route.page} view={route.view} />
      </Suspense>
    )
  }
  if (route.name === 'study') {
    return (
      <Suspense fallback={null}>
        <Study
          key={hrefFor(route)}
          subjectId={route.subjectId}
          early={route.early}
          length={route.length ?? null}
        />
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
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          className="min-h-11 rounded-lg px-3 text-sm text-[var(--fg-quiet)] sm:hidden"
        >
          {menuOpen ? 'Chiudi' : 'Menu'}
        </button>
        <nav
          id="main-nav"
          aria-label="Principale"
          className={`${menuOpen ? 'block' : 'hidden'} w-full sm:block sm:w-auto`}
        >
          <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
            {nav.map((item) => {
              const current =
                item.route.name === route.name ||
                (item.route.name === 'subjects' && (route.name === 'diary' || route.name === 'map'))
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
        <Suspense fallback={null}>
          {route.name === 'subjects' && <Subjects subjectId={route.subjectId} />}
          {route.name === 'settings' && <Settings />}
          {route.name === 'plan' && <Plan />}
          {route.name === 'library' && <Library />}
          {route.name === 'profile' && <Profile />}
          {route.name === 'diary' && <Diary />}
          {route.name === 'map' && <ProgramMap subjectId={route.subjectId} />}
          {route.name === 'tools' && <Tools tool={route.tool} />}
        </Suspense>
      </main>

      <footer className="flex flex-wrap justify-between gap-2 py-6 text-xs text-[var(--fg-quiet)]">
        <span>vector v1.3</span>
        <span>I tuoi dati restano su questo dispositivo.</span>
      </footer>
    </div>
  )
}
