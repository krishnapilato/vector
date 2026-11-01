import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('loads the app shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'vector' })).toBeVisible()
  await expect(page).toHaveTitle('Vector')
})

test('has zero animations and transitions', async ({ page }) => {
  await page.goto('/')
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .map((el) => {
        const s = getComputedStyle(el)
        const moving =
          s.animationName !== 'none' ||
          s.transitionDuration.split(',').some((d) => Number.parseFloat(d) > 0)
        return moving ? el.tagName.toLowerCase() : null
      })
      .filter(Boolean),
  )
  expect(animated).toEqual([])
})

test('has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('ships a web app manifest', async ({ page }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await page.request.get(href ?? '')
  expect(res.ok()).toBe(true)
  expect((await res.json()).name).toBe('Vector')
})
