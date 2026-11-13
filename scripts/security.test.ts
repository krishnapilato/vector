/** Guards against HTML injection (ADR 0006): no raw HTML anywhere in the app's source. */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const source = files('src').filter((f) => /\.(ts|svelte|astro)$/.test(f) && !f.endsWith('.test.ts'))

describe('no raw HTML', () => {
  it('never renders strings as HTML', () => {
    const offenders = source.filter((f) => {
      const text = readFileSync(f, 'utf8')
      const html = text.match(/\{@html|innerHTML|outerHTML|insertAdjacentHTML|document\.write/g)
      const setHtml = (text.match(/set:html/g) ?? []).length
      // The only exception: the PWA manifest link, generated at build time from our own config.
      const allowed = f.endsWith(join('layouts', 'Base.astro')) ? 1 : 0
      return html !== null || setHtml > allowed
    })
    expect(offenders).toEqual([])
  })

  it('never evaluates code from strings', () => {
    const offenders = source.filter((f) => /\beval\(|new Function\(/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
