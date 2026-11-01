// Finds t() calls evaluated at module load (before the language is set): they must be msg().
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  const walk = (node, inFn) => {
    if (!node || typeof node.type !== 'string') return
    const fn = inFn || /Function|ArrowFunction|ClassMethod|ObjectMethod/.test(node.type)
    if (!fn && node.type === 'CallExpression' && ['t', 'tn'].includes(node.callee?.name))
      console.log(`${file}:${node.loc.start.line}: ${src.slice(node.start, node.end).slice(0, 80)}`)
    for (const k of Object.keys(node)) {
      if (['loc', 'start', 'end'].includes(k)) continue
      const v = node[k]
      if (Array.isArray(v)) for (const c of v) walk(c, fn)
      else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, fn)
    }
  }
  walk(ast.program, false)
}
