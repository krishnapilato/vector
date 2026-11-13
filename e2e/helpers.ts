import { expect, type Page } from '@playwright/test'

/** First run with every default: four steps, all skippable. */
export async function onboard(page: Page): Promise<void> {
  await page.goto('./')
  await page.waitForURL(/welcome/)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Start studying' }).click()
  await page.waitForURL(/\/vector\/$/)
  await expect(page.getByRole('button', { name: 'I only have 10 minutes' })).toBeVisible()
}

/** Requests that left the app's own origin. */
export function watchExternal(page: Page): string[] {
  const external: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).hostname !== 'localhost') external.push(r.url())
  })
  return external
}
