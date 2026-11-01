// Fails the build when the core bundle grows past its budget.
// Features loaded on demand (lazy chunks) do not count toward the core budget.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 120 // gzipped JS + CSS loaded at startup
const dist = 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const entry = [...html.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.(?:js|css))"/g)].map(
  (m) => m[1],
)

if (entry.length === 0) {
  console.error('No entry assets found in dist/index.html — run the build first.')
  process.exit(1)
}

let total = 0
for (const file of entry) {
  const bytes = gzipSync(readFileSync(join(dist, file))).length
  total += bytes
  console.log(`${(bytes / 1024).toFixed(1).padStart(7)} kB  ${file}`)
}

const all = readdirSync(join(dist, 'assets')).length
const kb = total / 1024
console.log(
  `${kb.toFixed(1).padStart(7)} kB  core total (gzip), budget ${BUDGET_KB} kB · ${all} assets`,
)
if (kb > BUDGET_KB) {
  console.error(`Core bundle over budget by ${(kb - BUDGET_KB).toFixed(1)} kB.`)
  process.exit(1)
}
