import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('style guide', () => {
  test('has no accessibility violations', async ({ page }) => {
    await page.goto('./style')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('has no horizontal scroll at 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('./style')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('runs no transition or animation with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('./style')
    const moving = await page.evaluate(() => {
      const out: string[] = []
      for (const el of document.querySelectorAll('*')) {
        const style = getComputedStyle(el)
        const durations = [style.transitionDuration, style.animationDuration].join(',').split(',')
        if (durations.some((d) => Number.parseFloat(d) > 0)) out.push(el.className.toString())
      }
      return out
    })
    expect(moving).toEqual([])
  })

  test('shows the hidden timer after a 2 second hold', async ({ page }) => {
    await page.goto('./style')
    const timer = page.getByRole('button', { name: /Hold to see the time/ })
    await timer.hover()
    await page.mouse.down()
    await page.waitForTimeout(2200)
    await page.mouse.up()
    await expect(page.getByRole('button', { name: /^\d+:\d\d left$/ })).toBeVisible()
  })

  test('every control is at least 44 px tall', async ({ page }) => {
    await page.goto('./style')
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, a.button, input:not([type=radio]), label.option')]
        .filter((el) => el.checkVisibility() && el.getBoundingClientRect().height < 44)
        .map((el) => el.outerHTML.slice(0, 80)),
    )
    expect(small).toEqual([])
  })
})
