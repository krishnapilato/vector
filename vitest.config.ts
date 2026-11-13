import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts'],
      // PIANO-V3-LITE F2: every line of the focus logic and the timer is tested.
      thresholds: {
        'src/core/focus/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/core/session/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
})
