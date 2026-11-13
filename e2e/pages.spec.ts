import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

const routes = [
  '',
  'plan',
  'week',
  'logbook',
  'milestones',
  'materials',
  'settings',
  'settings/privacy',
]

test.describe('every screen', () => {
  test('has no accessibility violations and no horizontal scroll at 360 px', async ({ page }) => {
    test.setTimeout(120_000)
    await onboard(page)
    await page.setViewportSize({ width: 360, height: 780 })
    for (const route of routes) {
      await page.goto(`./${route}`)
      await page.locator('main h1').first().waitFor()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, route).toEqual([])
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, route).toBeLessThanOrEqual(0)
    }
  })

  test('works offline after the first visit', async ({ page, context }) => {
    await onboard(page)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await context.setOffline(true)
    for (const route of ['', 'plan', 'logbook', 'settings']) {
      await page.goto(`./${route}`)
      await expect(page.locator('main h1').first()).toBeVisible()
    }
    await context.setOffline(false)
  })
})
