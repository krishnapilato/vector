// Collects every translatable message: first argument of t(), tn() (two forms), msg() and tr().
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@babel/parser'

export function collectKeys(root = 'src') {
  const keys = new Map()
  const files = []
  const walkDir = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walkDir(p)
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !p.includes(`i18n${'/'}en.ts`))
        files.push(p)
    }
  }
  walkDir(root)
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    const visit = (node) => {
      if (!node || typeof node.type !== 'string') return
      if (node.type === 'CallExpression' && ['t', 'msg', 'tr'].includes(node.callee?.name)) {
        const literals = (a) =>
          !a
            ? []
            : a.type === 'StringLiteral'
              ? [a]
              : a.type === 'ConditionalExpression'
                ? [...literals(a.consequent), ...literals(a.alternate)]
                : a.type === 'LogicalExpression'
                  ? literals(a.right)
                  : []
        for (const l of literals(node.arguments[0]))
          keys.set(l.value, `${file}:${l.loc.start.line}`)
      }
      if (node.type === 'CallExpression' && node.callee?.name === 'tn') {
        for (const a of node.arguments.slice(1, 3))
          if (a?.type === 'StringLiteral') keys.set(a.value, `${file}:${a.loc.start.line}`)
      }
      for (const k of Object.keys(node)) {
        if (['loc', 'start', 'end'].includes(k)) continue
        const v = node[k]
        if (Array.isArray(v)) for (const c of v) visit(c)
        else if (v && typeof v === 'object' && typeof v.type === 'string') visit(v)
      }
    }
    visit(ast.program)
  }
  return keys
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = collectKeys()
  console.log(JSON.stringify([...keys.keys()], null, 0))
}
