// Lists user-visible-looking string literals not wrapped in t()/tn()/msg(). Helper for i18n work.
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'

const skipAttr = new Set([
  'className',
  'href',
  'id',
  'type',
  'role',
  'lang',
  'accept',
  'inputMode',
  'autoComplete',
  'key',
  'htmlFor',
  'aria-controls',
  'aria-hidden',
  'aria-live',
  'data-close',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'unit',
  'name',
  'mimeType',
])
const looks = (s) =>
  /[A-Za-zÀ-ÿ]/.test(s) &&
  /\s|[àèéìòù’]/.test(s) &&
  !/var\(--|^#\/|https?:\/\/|^[\w-]+\/[\w-]+$|min-h-|\bpx-|\bflex\b|\btext-|^\s*$/.test(s)
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  const walk = (node, inT, attr) => {
    if (!node || typeof node.type !== 'string') return
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'TSTypeAnnotation' ||
      node.type === 'TSLiteralType'
    )
      return
    let nowT = inT
    if (node.type === 'CallExpression' && ['t', 'tn', 'msg', 'tr'].includes(node.callee?.name))
      nowT = true
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      [
        'querySelector',
        'closest',
        'getItem',
        'setItem',
        'addEventListener',
        'removeEventListener',
        'createElement',
        'getContext',
        'split',
        'replace',
        'join',
        'includes',
        'startsWith',
        'endsWith',
        'toDataURL',
        'get',
        'set',
        'has',
        'test',
        'exec',
      ].includes(node.callee.property?.name)
    )
      nowT = true
    if (node.type === 'JSXAttribute') attr = node.name.name
    if (!nowT && !skipAttr.has(attr)) {
      if (node.type === 'StringLiteral' && looks(node.value))
        console.log(`${file}:${node.loc.start.line}: ${node.value}`)
      if (node.type === 'TemplateLiteral') {
        const txt = node.quasis.map((q) => q.value.cooked).join('{}')
        if (looks(txt)) console.log(`${file}:${node.loc.start.line}: \`${txt}\``)
      }
    }
    for (const k of Object.keys(node)) {
      if (['loc', 'start', 'end', 'leadingComments', 'trailingComments'].includes(k)) continue
      const v = node[k]
      if (Array.isArray(v)) for (const c of v) walk(c, nowT, attr)
      else if (v && typeof v === 'object' && typeof v.type === 'string')
        walk(v, nowT, node.type === 'JSXAttribute' ? attr : attr)
    }
  }
  walk(ast.program, false, null)
}
