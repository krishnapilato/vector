import { describe, expect, it } from 'vitest'
import { defaultConfig, parseConfig } from './config'
import defaults from './defaults.json'

describe('config', () => {
  it('ships valid defaults', () => {
    expect(defaultConfig.timers.recall).toBe(30)
  })

  it('rejects unknown keys', () => {
    expect(() => parseConfig({ ...defaults, extra: true })).toThrow()
  })

  it('rejects a pause threshold below the ignore threshold', () => {
    const bad = { ...defaults, focus: { ignoreDistractionSeconds: 10, pauseAfterSeconds: 5 } }
    expect(() => parseConfig(bad)).toThrow(/pauseAfterSeconds/)
  })

  it('rejects non-positive timers', () => {
    const bad = { ...defaults, timers: { ...defaults.timers, recall: 0 } }
    expect(() => parseConfig(bad)).toThrow()
  })
})
