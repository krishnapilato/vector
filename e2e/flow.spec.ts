import { expect, test } from '@playwright/test'
import { onboard, watchExternal } from './helpers'

test.describe('study flow (PIANO-V3 F2–F3)', () => {
  test('first run takes well under two minutes', async ({ page }) => {
    const start = Date.now()
    await onboard(page)
    expect(Date.now() - start).toBeLessThan(120_000)
  })

  test('one tap from Today to a clean session, wrap-up in under 10 s', async ({ page }) => {
    const external = watchExternal(page)
    await onboard(page)
    await page.getByRole('button', { name: 'I only have 10 minutes' }).click()
    await page.waitForURL(/session$/)
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    // The session screen keeps only what matters: no navigation.
    await expect(page.getByRole('navigation')).toHaveCount(0)

    const wrapStart = Date.now()
    await page.getByRole('button', { name: 'End' }).click()
    await page.getByRole('button', { name: 'Log them' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Back to Today' })).toBeVisible()
    await page.getByRole('button', { name: 'Back to Today' }).click()
    await page.waitForURL(/\/vector\/$/)
    expect(Date.now() - wrapStart).toBeLessThan(10_000)

    await page.goto('./logbook')
    await expect(page.locator('ol.logbook > li')).toHaveCount(1)
    expect(external).toEqual([])
  })

  test('a session survives closing the browser and resumes', async ({ browser, page }) => {
    await onboard(page)
    await page.getByRole('button', { name: 'I only have 10 minutes' }).click()
    await page.waitForURL(/session$/)
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
    const state = await page.context().storageState({ indexedDB: true })
    await page.context().close()

    const reopened = await browser.newContext({ storageState: state })
    const again = await reopened.newPage()
    await again.goto('./')
    await again.getByRole('link', { name: 'Resume' }).click()
    await again.waitForURL(/session$/)
    await expect(again.getByRole('button', { name: 'Resume' })).toBeVisible()
    await reopened.close()
  })
})
