import type { Page } from '@playwright/test'

/**
 * Collects every request that leaves the app's own address. blob: and data: URLs live in the
 * browser's memory and never reach the network, so they are not counted.
 */
export function watchExternal(page: Page): string[] {
  const external: string[] = []
  page.on('request', (r) => {
    if (/^(blob|data):/.test(r.url())) return
    if (new URL(r.url()).hostname !== 'localhost') external.push(r.url())
  })
  return external
}

interface SessionOptions {
  tag?: string
  minutes?: string
  camera?: boolean
}

/**
 * Starts a session from the Focus screen with the given options. Choices are made by role and
 * name, the way a screen reader sees them.
 */
export async function startSession(page: Page, options: SessionOptions = {}): Promise<void> {
  const { tag = '', minutes = '25m', camera = false } = options
  await page.goto('./')
  await page.getByRole('button', { name: 'Start' }).waitFor()
  if (tag) await page.getByLabel('What are you working on?').fill(tag)
  await page.getByRole('radio', { name: minutes, exact: true }).check()
  const cameraSwitch = page.getByRole('switch', { name: 'Camera focus tracking' })
  if ((await cameraSwitch.getAttribute('aria-checked')) !== String(camera))
    await cameraSwitch.click()
  await page.getByRole('button', { name: 'Start' }).click()
}
