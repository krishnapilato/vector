// JS weight budget (PIANO-V3-LITE §5.1): the Focus page ships < 50 kB of gzipped JS before any
// session starts. The database, the camera and the face model load only when needed.
// Follows every script the built HTML references, plus their static imports.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = resolve('dist')
const base = '/vector/'
const budgets = [{ page: 'index.html', limitKb: 50 }]

function toFile(url, from) {
  if (url.startsWith(base)) return join(dist, url.slice(base.length))
  if (url.startsWith('/')) return join(dist, url)
  return resolve(dirname(from), url)
}

function scriptsOf(html) {
  const urls = new Set()
  const patterns = [
    /<script[^>]+src="([^"]+\.js)"/g,
    /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g,
    /(?:component-url|renderer-url|before-hydration-url)="([^"]+)"/g,
  ]
  for (const re of patterns) for (const m of html.matchAll(re)) if (m[1]) urls.add(m[1])
  return urls
}

/** Static imports only: dynamic import() chunks load later, on demand. */
function importsOf(code) {
  const out = new Set()
  for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.js)["']/g))
    if (m[1]) out.add(m[1])
  return out
}

let failed = false
for (const { page, limitKb } of budgets) {
  const htmlPath = join(dist, page)
  const html = readFileSync(htmlPath, 'utf8')
  const seen = new Set()
  const queue = [...scriptsOf(html)].map((u) => toFile(u, htmlPath))
  let bytes = 0
  while (queue.length > 0) {
    const file = queue.pop()
    if (!file || seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const code = readFileSync(file)
    bytes += gzipSync(code).length
    for (const rel of importsOf(code.toString())) queue.push(resolve(dirname(file), rel))
  }
  const kb = bytes / 1024
  const ok = kb < limitKb
  failed ||= !ok
  console.log(
    `${ok ? 'ok ' : 'FAIL'} ${page}: ${kb.toFixed(1)} kB gzip JS (limit ${limitKb} kB, ${seen.size} files)`,
  )
}
if (failed) process.exit(1)
