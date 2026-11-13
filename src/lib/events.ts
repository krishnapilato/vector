/** Fired after every write: the sync runner listens to it. */
export const changedEvent = 'vector:changed'

export function notifyChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(changedEvent))
}
