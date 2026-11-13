import { expect, test } from '@playwright/test'

test('the app opens ready to use and is installable as a PWA', async ({ page }) => {
  await page.goto('./')
  // Usable from the first second: no onboarding (PIANO-V3-LITE §1).
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await page.request.get(manifestHref ?? '')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain('512x512')

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toMatch(/\/vector\/$/)
})
