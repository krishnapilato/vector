import { describe, expect, it } from 'vitest'
import { glide, headAngles } from './geometry'

const rotationY = (deg: number) => {
  const a = (deg * Math.PI) / 180
  return [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]
}
const rotationZ = (deg: number) => {
  const a = (deg * Math.PI) / 180
  return [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

describe('camera geometry', () => {
  it('reads a straight head as zero angles', () => {
    const a = headAngles([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    expect(a.yaw).toBeCloseTo(0)
    expect(a.pitch).toBeCloseTo(0)
    expect(a.roll).toBeCloseTo(0)
  })

  it('reads a head turned by 30 degrees and tilted by 15', () => {
    expect(headAngles(rotationY(30)).yaw).toBeCloseTo(30)
    expect(headAngles(rotationZ(15)).roll).toBeCloseTo(15)
  })

  it('fills a missing matrix with neutral values', () => {
    expect(headAngles([])).toEqual({ yaw: -0, pitch: 0, roll: 0 })
  })

  it('glides drawn points towards the detection and snaps on a new shape', () => {
    expect(glide([{ x: 0, y: 0 }], [{ x: 1, y: 1 }], 0.5)).toEqual([{ x: 0.5, y: 0.5 }])
    expect(glide(null, [{ x: 1, y: 1 }], 0.5)).toEqual([{ x: 1, y: 1 }])
    expect(
      glide(
        [{ x: 0, y: 0 }],
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        0.5,
      ),
    ).toHaveLength(2)
  })
})
