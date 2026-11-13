import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** Reads every `--color-*: oklch(L% C H)` token from tokens.css. */
function colorTokens(): Map<string, [number, number, number]> {
  const out = new Map<string, [number, number, number]>()
  for (const m of css.matchAll(/--color-([a-z-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)) {
    const [, name, l, c, h] = m
    if (name && l && c && h) out.set(name, [Number(l) / 100, Number(c), Number(h)])
  }
  return out
}

/** OKLCH to linear sRGB (Björn Ottosson's OKLab matrices). */
function linearRgb([l, c, h]: [number, number, number]): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
}

function luminance(color: [number, number, number]): number {
  const [r, g, b] = linearRgb(color).map((v) => Math.min(1, Math.max(0, v))) as [
    number,
    number,
    number,
  ]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const tokens = colorTokens()
  const a = tokens.get(fg)
  const b = tokens.get(bg)
  if (!a || !b) throw new Error(`Unknown token: ${a ? bg : fg}`)
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const surfaces = ['bg', 'surface', 'surface-raised']

/** Text pairs need 4.5:1 (WCAG AA, normal text). */
const textPairs: [string, string][] = [
  ...surfaces.flatMap((s): [string, string][] => [
    ['text', s],
    ['text-secondary', s],
    ['accent', s],
    ['success', s],
    ['attention', s],
  ]),
  ['text', 'fill'],
  ['text-secondary', 'fill'],
  ['accent', 'fill'],
  ['text', 'fill-strong'],
  ['on-accent', 'sidebar'],
  ['on-accent', 'accent'],
  ['on-accent', 'accent-strong'],
  ['accent', 'accent-soft'],
  ['accent-strong', 'accent-soft'],
  ['text', 'accent-soft'],
  ['success', 'success-soft'],
  ['text', 'success-soft'],
  ['attention', 'attention-soft'],
  ['text', 'attention-soft'],
]

/** Control borders and the focus ring need 3:1 (WCAG AA, non-text contrast). */
const uiPairs: [string, string][] = [
  ...surfaces.flatMap((s): [string, string][] => [
    ['border-strong', s],
    ['accent', s],
  ]),
  ['border-strong', 'fill'],
]

describe('design tokens', () => {
  it('defines every colour inside the sRGB gamut', () => {
    for (const [name, value] of colorTokens()) {
      for (const channel of linearRgb(value)) {
        expect(channel, name).toBeGreaterThan(-0.002)
        expect(channel, name).toBeLessThan(1.002)
      }
    }
  })

  it.each(textPairs)('%s on %s reaches 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(uiPairs)('%s on %s reaches 3:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3)
  })

  it('has one light theme only', () => {
    expect(css).toContain('color-scheme: light')
    expect(css).not.toMatch(/prefers-color-scheme|data-theme/)
  })

  it('switches motion off when reduced motion is requested', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'))
    expect(reduced).toMatch(/--duration-fast:\s*0ms/)
    expect(reduced).toMatch(/--duration-base:\s*0ms/)
  })
})
