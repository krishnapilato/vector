/** Restrict SDK fetches inside the vision worker; document CSP does not cover its network. */
export function localFetch(fetcher: typeof fetch, workerUrl: string): typeof fetch {
  const origin = new URL(workerUrl).origin
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), workerUrl)
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
      throw new TypeError('Vision worker only fetches same-origin resources')
    }
    // A local URL must not redirect the SDK to an external host.
    return fetcher(input, { ...init, redirect: 'error' })
  }
}
