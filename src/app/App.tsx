import { defaultConfig } from '../config/config'
import { formatSeconds, timeLimitFor } from '../core/question-timer'

/**
 * v0.1 shell: proves the stack end to end (React, Tailwind tokens, config,
 * a pure core module) with the Vector look — black, white, nothing extra.
 */
export function App() {
  const recall = timeLimitFor('recall', defaultConfig)

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-medium tracking-tight">vector</h1>
      <p className="text-lg leading-relaxed">Studia i concetti, non le risposte.</p>
      <p className="text-sm text-[var(--fg-quiet)]">
        v0.1 · fondamenta · timer richiamo {formatSeconds(recall)}
      </p>
    </main>
  )
}
