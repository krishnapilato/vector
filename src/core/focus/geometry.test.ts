import { describe, expect, it } from 'vitest'
import { ease, faceBox, glide, handOnFace, headAngles, shoulderHeight } from './geometry'

describe('camera geometry', () => {
  it('reads a straight head as zero angles', () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    expect(headAngles(identity)).toEqual({ yaw: -0, pitch: 0 })
  })

  it('reads a head turned by 30 degrees', () => {
    const a = (30 * Math.PI) / 180
    const turned = [
      Math.cos(a),
      0,
      -Math.sin(a),
      0,
      0,
      1,
      0,
      0,
      Math.sin(a),
      0,
      Math.cos(a),
      0,
      0,
      0,
      0,
      1,
    ]
    expect(headAngles(turned).yaw).toBeCloseTo(30)
  })

  it('grows the face box to include the chin', () => {
    const box = faceBox([
      { x: 0.4, y: 0.3 },
      { x: 0.6, y: 0.5 },
    ])
    expect(box?.x0).toBeCloseTo(0.36)
    expect(box?.x1).toBeCloseTo(0.64)
    expect(box?.y0).toBeCloseTo(0.23)
    expect(box?.y1).toBeCloseTo(0.57)
    expect(faceBox([])).toBeNull()
  })

  it('finds a hand resting on the face', () => {
    const box = { x0: 0.3, x1: 0.7, y0: 0.2, y1: 0.7 }
    const onChin = [{ x: 0.5, y: 0.65 }]
    const away = [{ x: 0.9, y: 0.9 }]
    expect(handOnFace([onChin], box)).toBe(true)
    expect(handOnFace([away], box)).toBe(false)
    expect(handOnFace([onChin], null)).toBe(false)
  })

  it('needs both shoulders visible', () => {
    const pose = Array.from({ length: 13 }, () => ({ x: 0, y: 0.8, visibility: 0.9 }))
    expect(shoulderHeight(pose)).toBeCloseTo(0.8)
    pose[12] = { x: 0, y: 0.8, visibility: 0.2 }
    expect(shoulderHeight(pose)).toBeNull()
    expect(shoulderHeight(null)).toBeNull()
  })

  it('glides drawn points towards the detection and snaps on a new shape', () => {
    const moved = glide([{ x: 0, y: 0 }], [{ x: 1, y: 1 }], 0.5)
    expect(moved).toEqual([{ x: 0.5, y: 0.5 }])
    expect(glide(null, [{ x: 1, y: 1 }], 0.5)).toEqual([{ x: 1, y: 1 }])
    expect(ease(null, 10, 0.3)).toBe(10)
    expect(ease(0, 10, 0.3)).toBeCloseTo(3)
  })
})
