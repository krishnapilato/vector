import { describe, expect, it, vi } from 'vitest'
import { localFetch } from './worker-network'

describe('vision worker network policy', () => {
  it('loads local resources with redirects disabled and preserves fetch options', async () => {
    const response = new Response('model')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    const fetchLocal = localFetch(fetcher, 'https://vector.example/vector/worker.js')
    const request = new Request('https://vector.example/vector/models/face.task')
    expect(await fetchLocal(request, { cache: 'force-cache', redirect: 'follow' })).toBe(response)
    expect(fetcher).toHaveBeenCalledWith(request, { cache: 'force-cache', redirect: 'error' })
    await fetchLocal(new URL('https://vector.example/vector/model.wasm'))
    expect(fetcher).toHaveBeenLastCalledWith(new URL('https://vector.example/vector/model.wasm'), {
      redirect: 'error',
    })
  })

  it.each([
    'https://odml.pa.googleapis.com/v1/log',
    '//external.example/log',
    'http://vector.example/log',
    'https://vector.example:8443/log',
    'data:text/plain,telemetry',
  ])('blocks %s before it reaches the network', async (url) => {
    const fetcher = vi.fn<typeof fetch>()
    const fetchLocal = localFetch(fetcher, 'https://vector.example/vector/worker.js')
    await expect(fetchLocal(url)).rejects.toThrow('same-origin')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('blocks external Request objects as well as strings', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const fetchLocal = localFetch(fetcher, 'https://vector.example/vector/worker.js')
    await expect(fetchLocal(new Request('https://external.example/log'))).rejects.toThrow(
      'same-origin',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
})
