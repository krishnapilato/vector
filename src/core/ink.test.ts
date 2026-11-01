import { describe, expect, it } from 'vitest'
import {
  bounds,
  buildTranscribePrompt,
  hitStroke,
  type Point,
  type Stroke,
  strokePath,
  thin,
} from './ink'

const line: Stroke = {
  points: [
    [0.1, 0.1, 0.5],
    [0.5, 0.1, 0.5],
  ],
  width: 0.004,
}

describe('ink', () => {
  it('draws a stroke as an SVG path scaled to the page', () => {
    const d = strokePath(line, 800)
    expect(d).toMatch(/^M[\d.]+,[\d.]+L/)
    expect(d.endsWith('Z')).toBe(true)
    expect(strokePath({ points: [], width: 0.004 }, 800)).toBe('')
    expect(strokePath({ ...line, kind: 'marker', width: 0.02 }, 800).length).toBeGreaterThan(10)
  })

  it('finds the stroke under the eraser', () => {
    const dot: Stroke = { points: [[0.8, 0.8, 0.5]], width: 0.004 }
    expect(hitStroke([line, dot], 0.3, 0.105, 0.01)).toBe(0)
    expect(hitStroke([line, dot], 0.8, 0.805, 0.01)).toBe(1)
    expect(hitStroke([line, dot], 0.3, 0.5, 0.01)).toBe(-1)
    expect(
      hitStroke(
        [
          {
            points: [
              [0.2, 0.2, 0.5],
              [0.2, 0.2, 0.5],
            ],
            width: 0.004,
          },
        ],
        0.2,
        0.2,
        0.01,
      ),
    ).toBe(0)
  })

  it('thins dense points but keeps the end', () => {
    const pts: Point[] = Array.from({ length: 100 }, (_, i) => [i * 0.0001, 0, 0.5])
    const t = thin(pts)
    expect(t.length).toBeLessThan(10)
    expect(t[t.length - 1]).toEqual(pts[pts.length - 1])
    expect(thin([])).toEqual([])
  })

  it('computes bounds with a margin', () => {
    expect(bounds([])).toBeNull()
    expect(bounds([line], 0)).toEqual({ x: 0.1, y: 0.1, right: 0.5, bottom: 0.1 })
  })

  it('asks for a faithful transcription', () => {
    expect(buildTranscribePrompt('en')).toContain('in inglese')
    expect(buildTranscribePrompt('it')).toContain('[?]')
  })
})
