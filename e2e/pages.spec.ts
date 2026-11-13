import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { startSession } from './helpers'

const routes = ['', 'logbook', 'settings', 'style']

test.describe('every screen', () => {
  test('has no accessibility violations and no horizontal scroll at 360 px', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 360, height: 780 })
    for (const route of routes) {
      await page.goto(`./${route}`)
      await page.locator('h1').first().waitFor()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, route).toEqual([])
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, route).toBeLessThanOrEqual(0)
    }
  })

  test('the session screen has no accessibility violations', async ({ page }) => {
    await startSession(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('works offline after the first visit', async ({ page, context }) => {
    await page.goto('./')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await context.setOffline(true)
    for (const route of routes) {
      await page.goto(`./${route}`)
      await expect(page.locator('h1').first()).toBeVisible()
    }
    await page.goto('./')
    // App offline support is independent of the optional model cache.
    const camera = page.getByRole('switch', { name: 'Camera focus tracking' })
    if ((await camera.getAttribute('aria-checked')) === 'true') await camera.click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await context.setOffline(false)
  })
})

test.describe('settings (PIANO-V3-LITE §4.3)', () => {
  test('deleting all data asks twice', async ({ page }) => {
    await page.goto('./settings')
    await page.getByRole('radio', { name: 'Data' }).check()
    await page.getByRole('button', { name: 'Delete all data' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('This can’t be undone.', { exact: false })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete all data' }).click()
    await expect(page.getByText('Everything on this device is deleted.')).toBeVisible()
  })
})

test.describe('workspace design', () => {
  test('keeps the desktop frame within one viewport and opens privacy from the shield', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    await page.getByRole('button', { name: 'Start', exact: true }).waitFor()
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    )
    const rail = await page.locator('header').boundingBox()
    expect(rail?.width).toBeLessThanOrEqual(80)
    await page.getByRole('link', { name: 'Privacy and data security' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy & Security Manifesto' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(1)
  })

  test('allows retrying the same backup file and announces the selected filename', async ({
    page,
  }) => {
    await page.goto('./settings')
    await page.getByRole('radio', { name: 'Data', exact: true }).check()
    const input = page.getByLabel('Import backup', { exact: true })
    const invalid = {
      name: 'invalid-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      await input.setInputFiles(invalid)
      await expect(
        page.getByText('This file isn’t a Vector backup, or it is damaged.'),
      ).toBeVisible()
      await expect(page.getByRole('status').filter({ hasText: 'Selected file:' })).toHaveText(
        'Selected file: invalid-backup.json',
      )
      await expect(input).toHaveValue('')
    }
  })
})

test('logbook filters saved tasks and notes, clears the filter and exports CSV', async ({
  page,
}) => {
  await startSession(page, { tag: 'Reading' })
  await page.getByRole('button', { name: 'End', exact: true }).click()
  await page.getByLabel('Note', { exact: true }).fill('Revisit chapter two')
  await page.getByRole('button', { name: 'Save to logbook', exact: true }).click()
  await page.getByRole('link', { name: 'Logbook', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reading', exact: true })).toBeVisible()
  await page.getByLabel('Filter by tag or note').fill('chapter')
  await expect(page.getByRole('status')).toHaveText('1 of 1 sessions')
  await page.getByLabel('Filter by tag or note').fill('missing')
  await expect(page.getByRole('heading', { name: 'No matching sessions.' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filter', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reading', exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await download).suggestedFilename()).toMatch(/^vector-logbook-.*\.csv$/)
})
