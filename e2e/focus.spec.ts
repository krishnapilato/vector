import { expect, test } from '@playwright/test'
import { startSession, watchExternal } from './helpers'

test.describe('Focus (PIANO-V3-LITE §4.1)', () => {
  test('one tap to start, a calm session, wrap-up in under 10 s', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'Start' }).click()
    // The camera is on by default, so the very first session calibrates first (skippable).
    await page.getByRole('button', { name: 'Skip' }).click()
    // The session hides everything that is not needed.
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(page.getByText('Tap to see the time')).toBeVisible()

    const wrapStart = Date.now()
    await page.getByRole('button', { name: 'End' }).click()
    await page.getByRole('radio', { name: /^5/ }).check()
    await page.getByLabel('Note').fill('Stopped at page 124')
    await page.getByRole('button', { name: 'Save to logbook' }).click()
    await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible()
    expect(Date.now() - wrapStart).toBeLessThan(10_000)

    await page.goto('./logbook')
    await expect(page.getByText('Stopped at page 124')).toBeVisible()
    await expect(page.getByText('5/5')).toBeVisible()
  })

  test('shows the time for 3 seconds on a tap', async ({ page }) => {
    await startSession(page)
    await page.getByText('Tap to see the time').click()
    await expect(page.getByText(/^\d+:\d\d$/)).toBeVisible()
    await expect(page.getByText('Tap to see the time')).toBeVisible({ timeout: 5000 })
  })

  test('runs an Open session as a stopwatch', async ({ page }) => {
    await startSession(page, { minutes: 'Open' })
    await page.getByText('Tap to see the time').click()
    await expect(page.getByText('so far')).toBeVisible()
  })

  test('a session survives closing the browser and resumes', async ({ browser, page }) => {
    await startSession(page, { tag: 'Deep work' })
    await page.getByRole('button', { name: 'Pause' }).click()
    const state = await page.context().storageState()
    await page.context().close()

    const reopened = await browser.newContext({ storageState: state })
    const again = await reopened.newPage()
    await again.goto('./')
    await expect(again.getByRole('heading', { name: 'Deep work' })).toBeVisible()
    await expect(again.getByRole('button', { name: 'Resume' })).toBeVisible()
    await reopened.close()
  })

  test('starts fresh without suggestions from previous sessions', async ({ page }) => {
    await startSession(page, { tag: 'Linear algebra' })
    await page.getByRole('button', { name: 'End' }).click()
    await page.getByRole('button', { name: 'Save to logbook' }).click()
    await expect(page.getByRole('button', { name: 'Linear algebra' })).toHaveCount(0)
    await page.getByLabel('What are you working on?').fill('A new intention')
    await expect(page.getByLabel('What are you working on?')).toHaveValue('A new intention')
  })
})

test.describe('camera (PIANO-V3-LITE §5)', () => {
  test('calibrates, then runs with zero network requests and no image on the page', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const external = watchExternal(page)
    await startSession(page, { camera: true })
    // First camera session: a 15-second calibration, which can be skipped.
    await expect(page.getByRole('heading', { name: /15 seconds/ })).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByText('Camera active · Local only')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(4000)
    expect(external).toEqual([])
    // During the session no video or canvas of the camera is ever on the page.
    await expect(page.locator('video, canvas')).toHaveCount(0)
  })
})

test('a late camera response cannot reopen a finished session', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: (() => void)[] = []
    Object.assign(window, {
      rejectPendingCameras: () => {
        for (const reject of pending.splice(0)) reject()
      },
      pendingCameras: pending,
    })
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((_resolve, reject) => {
        pending.push(() => reject(new DOMException('Permission denied', 'NotAllowedError')))
      })
  })
  await startSession(page, { camera: true })
  await page.waitForFunction(
    () => (window as unknown as { pendingCameras: unknown[] }).pendingCameras.length > 0,
  )
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'End', exact: true }).click()
  await page.evaluate(async () => {
    ;(window as unknown as { rejectPendingCameras: () => void }).rejectPendingCameras()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await expect(page.getByRole('button', { name: 'Save to logbook', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
})
