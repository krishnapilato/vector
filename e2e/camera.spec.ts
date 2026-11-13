import { expect, test } from '@playwright/test'
import { onboard, watchExternal } from './helpers'

test.describe('camera focus (PIANO-V3 F5)', () => {
  test('runs on this device only: no request leaves the app during analysis', async ({ page }) => {
    test.setTimeout(90_000)
    const external = watchExternal(page)
    await onboard(page)
    await page.goto('./settings')
    // Turning the camera on asks permission, saves, then caches the model for offline use.
    const modelCached = page.waitForResponse((r) => r.url().includes('face_landmarker.task'))
    await page.getByRole('switch', { name: 'Camera' }).click()
    await modelCached
    await page.goto('./')
    await page.getByRole('button', { name: 'I only have 10 minutes' }).click()
    await page.waitForURL(/session$/)
    await expect(page.getByText('Camera on, this device only')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(5000)
    expect(external).toEqual([])
    // No video, canvas or image of the camera is ever on the page.
    await expect(page.locator('video, canvas')).toHaveCount(0)
  })
})
