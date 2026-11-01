import { fill, msg, type Vars } from '../i18n'
/**
 * A small, safe calculator: a recursive-descent parser, never `eval`.
 * Supports + − × ÷ ^, parentheses, decimal comma or point, pi, and
 * sin cos tan asin acos atan (in DEGREES, as in navigation), sqrt abs ln log round.
 */

export type CalcResult =
  | { ok: true; value: number }
  | { ok: false; error: string; message: string; vars?: Vars }

/** An error whose message can be translated: `message` is the template, `vars` fill it. */
class CalcError extends Error {
  constructor(
    public template: string,
    public vars?: Vars,
  ) {
    super(fill(template, vars))
  }
}

const fail = (template: string, vars?: Vars): CalcResult => ({
  ok: false,
  error: fill(template, vars),
  message: template,
  ...(vars ? { vars } : {}),
})

const functions: Record<string, (x: number) => number> = {
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  round: Math.round,
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: string }
  | { kind: 'id'; value: string }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const s = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  let i = 0
  while (i < s.length) {
    const c = s[i] as string
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.,]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.,]/.test(s[j] as string)) j++
      const raw = s.slice(i, j).replace(',', '.')
      if (!/^\d*\.?\d+$|^\d+\.$/.test(raw))
        throw new CalcError(msg('Numero non valido: {x}'), { x: s.slice(i, j) })
      tokens.push({ kind: 'num', value: Number(raw) })
      i = j
    } else if (/[a-z]/i.test(c)) {
      let j = i
      while (j < s.length && /[a-z]/i.test(s[j] as string)) j++
      tokens.push({ kind: 'id', value: s.slice(i, j).toLowerCase() })
      i = j
    } else if ('+-*/^()'.includes(c)) {
      tokens.push({ kind: 'op', value: c })
      i++
    } else {
      throw new CalcError(msg('Carattere non valido: {x}'), { x: c })
    }
  }
  return tokens
}

export function evaluate(input: string): CalcResult {
  if (!input.trim()) return fail(msg('Scrivi un calcolo.'))
  try {
    const tokens = tokenize(input)
    let pos = 0
    const peek = () => tokens[pos]
    const isOp = (v: string) => {
      const t = peek()
      return t?.kind === 'op' && t.value === v
    }

    // expr := term (('+'|'-') term)*
    const expr = (): number => {
      let v = term()
      while (isOp('+') || isOp('-')) {
        const op = (tokens[pos++] as Token).value
        v = op === '+' ? v + term() : v - term()
      }
      return v
    }
    // term := power (('*'|'/') power)*
    const term = (): number => {
      let v = unary()
      while (isOp('*') || isOp('/')) {
        const op = (tokens[pos++] as Token).value
        const r = unary()
        if (op === '/' && r === 0) throw new CalcError(msg('Divisione per zero.'))
        v = op === '*' ? v * r : v / r
      }
      return v
    }
    // unary := '-' unary | power
    const unary = (): number => {
      if (isOp('-')) {
        pos++
        return -unary()
      }
      if (isOp('+')) {
        pos++
        return unary()
      }
      return power()
    }
    // power := atom ('^' unary)?   (right-associative)
    const power = (): number => {
      const base = atom()
      if (isOp('^')) {
        pos++
        return base ** unary()
      }
      return base
    }
    // atom := number | pi | fn '(' expr ')' | '(' expr ')'
    const atom = (): number => {
      const t = tokens[pos++]
      if (!t) throw new CalcError(msg('Calcolo incompleto.'))
      if (t.kind === 'num') return t.value
      if (t.kind === 'id') {
        if (t.value === 'pi') return Math.PI
        const fn = functions[t.value]
        if (!fn) throw new CalcError(msg('Funzione sconosciuta: {x}'), { x: t.value })
        if (!isOp('(')) throw new CalcError(msg('Dopo {x} serve una parentesi.'), { x: t.value })
        pos++
        const v = expr()
        if (!isOp(')')) throw new CalcError(msg('Manca una parentesi chiusa.'))
        pos++
        return fn(v)
      }
      if (t.value === '(') {
        const v = expr()
        if (!isOp(')')) throw new CalcError(msg('Manca una parentesi chiusa.'))
        pos++
        return v
      }
      throw new CalcError(msg('Simbolo inatteso: {x}'), { x: t.value })
    }

    const value = expr()
    if (pos < tokens.length) throw new CalcError(msg('Calcolo non valido.'))
    if (!Number.isFinite(value)) return fail(msg('Risultato non definito.'))
    return { ok: true, value }
  } catch (e) {
    return e instanceof CalcError ? fail(e.template, e.vars) : fail(msg('Calcolo non valido.'))
  }
}
