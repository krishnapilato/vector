import { defineConfig, devices } from '@playwright/test'

const port = 4173
/** A fake camera so the focus pipeline runs end to end without a real webcam. */
const camera = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}/vector/`,
    trace: 'retain-on-failure',
    launchOptions: { args: camera },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && node scripts/serve-dist.mjs ${port}`,
    url: `http://localhost:${port}/vector/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
})
