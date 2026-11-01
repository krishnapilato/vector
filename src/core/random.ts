/** Small seeded PRNG (mulberry32): deterministic in tests, varied in use. */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/** Integer in [min, max], inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)]
  if (item === undefined) throw new Error('pick() on an empty list')
  return item
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}
