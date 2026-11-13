/**
 * A Dexie live query as Svelte 5 state: the view follows the database, sync included.
 * Values stay plain objects ($state.raw), so they can be written back to IndexedDB as they are.
 */
import { liveQuery } from 'dexie'

export function live<T>(
  query: () => Promise<T>,
  initial: T,
): { readonly value: T; readonly ready: boolean } {
  let value = $state.raw(initial)
  let ready = $state(false)
  $effect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (next) => {
        value = next
        ready = true
      },
      error: (error: unknown) => console.error(error),
    })
    return () => subscription.unsubscribe()
  })
  return {
    get value() {
      return value
    },
    get ready() {
      return ready
    },
  }
}
