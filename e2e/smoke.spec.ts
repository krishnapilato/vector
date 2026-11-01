import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

async function expectNoAnimations(page: Page) {
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => {
        const s = getComputedStyle(el)
        return (
          s.animationName !== 'none' ||
          s.transitionDuration.split(',').some((d) => Number.parseFloat(d) > 0)
        )
      })
      .map((el) => el.tagName.toLowerCase()),
  )
  expect(animated).toEqual([])
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

/** Answers whatever the current step asks, always with the first choice. */
async function answerOneStep(page: Page) {
  const reveal = page.getByRole('button', { name: 'Mostra le opzioni' })
  if (await reveal.isVisible()) await reveal.click()
  const next = page.getByRole('button', { name: 'Avanti' })
  if (await next.isVisible()) return next.click()
  await page.locator('[data-choice="1"]').click()
}

test('home, menu and footer', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Vector')
  await expect(
    page.getByRole('heading', { name: 'Studia i concetti, non le risposte.' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Studia', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByText('I tuoi dati restano su questo dispositivo.')).toBeVisible()
  await expectNoAnimations(page)
  await expectAccessible(page)
})

test('a full study session, resumable and saved locally', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Inizia a studiare' }).click()

  // Study state: no menu, no footer.
  await expect(page.getByRole('navigation', { name: 'Principale' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Esci e salva la sessione' })).toBeVisible()
  await expectAccessible(page)

  // First question, then leave and come back: the session resumes.
  await answerOneStep(page)
  await page.getByRole('button', { name: 'Esci e salva la sessione' }).click()
  await expect(page.getByRole('link', { name: 'Riprendi da dove eri' })).toBeVisible()
  await page.getByRole('link', { name: 'Riprendi da dove eri' }).click()

  for (let i = 0; i < 80; i++) {
    if (await page.getByRole('heading', { name: 'Sessione finita.' }).isVisible()) break
    await answerOneStep(page)
  }
  await expect(page.getByRole('heading', { name: 'Sessione finita.' })).toBeVisible()
  await expectNoAnimations(page)
  await page.getByRole('link', { name: 'Fine' }).click()

  // Progress survives a reload: it lives in IndexedDB.
  await page.reload()
  await expect(page.getByText('Comprensione')).toBeVisible()
})

test('a timeout counts as "don\'t know"', async ({ page }) => {
  await page.goto('/#/impostazioni')
  for (const label of ['Richiamo veloce', 'Ragionamento', 'Calcolo']) {
    const input = page.getByLabel(label)
    await input.fill('5')
    await input.press('Enter')
  }
  const think = page.getByLabel('Pausa per pensare prima delle opzioni')
  await think.fill('0')
  await think.press('Enter')
  await expect(page.getByText('Salvato su questo dispositivo.')).toBeVisible()

  await page.goto('/#/studia')
  await expect(page.getByText('Non saputa.')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Dal testo', { exact: false })).toBeVisible()
})

test('subjects and settings are accessible', async ({ page }) => {
  await page.goto('/#/materie')
  await expect(page.getByRole('heading', { name: 'Materie' })).toBeVisible()
  await page.getByRole('link', { name: /Meteorologia/ }).click()
  await expect(page.getByRole('heading', { name: 'Atmosfera standard (ISA)' })).toBeVisible()
  await expectAccessible(page)

  await page.goto('/#/impostazioni')
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()
  await page.getByLabel('Capire').check()
  await expect(page.getByText('Salvato su questo dispositivo.')).toBeVisible()
  await expectAccessible(page)
})

test('ships a web app manifest', async ({ page }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const res = await page.request.get(href ?? '')
  expect(res.ok()).toBe(true)
  expect((await res.json()).name).toBe('Vector')
})

test('plan: exam date, a weekly session and the .ics export', async ({ page }) => {
  await page.goto('/#/piano')
  await expect(page.getByRole('heading', { name: 'Piano', exact: true })).toBeVisible()
  const exam = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  await page.getByLabel("Data dell'esame teorico").fill(exam)
  await expect(page.getByText(/Mancano \d+ giorni/)).toBeVisible()

  await page.getByLabel('Ripeti').selectOption('2')
  await page.getByLabel('Materia').selectOption({ label: 'Meteorologia' })
  await page.getByRole('button', { name: 'Aggiungi' }).click()
  await expect(page.getByText('2 sessioni aggiunte.')).toBeVisible()
  await expect(page.getByText(/18:30 · 45 min · Studio · Meteorologia/).first()).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Esporta per Google Calendar/ }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('vector-piano.ics')
  await expectAccessible(page)

  await page.goto('/')
  await expect(page.getByText(/Esame tra \d+ giorni/)).toBeVisible()
})

test('tools: calculator and wind triangle', async ({ page }) => {
  await page.goto('/#/strumenti')
  await page.getByLabel(/Calcolo/).fill('120 * cos(60)')
  await expect(page.getByText('= 60')).toBeVisible()

  await page.getByRole('link', { name: 'Vento' }).click()
  await page.getByLabel(/Rotta vera/).fill('0')
  await page.getByLabel(/TAS/).fill('100')
  await page.getByLabel(/Vento da/).fill('90')
  await page.getByLabel(/Intensità/).fill('20')
  await expect(page.getByText('11,5° a destra')).toBeVisible()
  await expectNoAnimations(page)
  await expectAccessible(page)
})

test('tools open inside a study session without leaving it', async ({ page }) => {
  await page.goto('/#/studia')
  await page.getByRole('button', { name: 'Strumenti' }).click()
  const panel = page.getByRole('complementary', { name: 'Strumenti' })
  await expect(panel).toBeVisible()
  // Typing numbers in the calculator must not answer the question.
  await panel.getByLabel(/Calcolo/).fill('2+2')
  await panel.getByLabel(/Calcolo/).press('1')
  await expect(panel.getByText('= 23')).toBeVisible()
  await expect(page.getByText('Quanto ne sei sicuro?')).toHaveCount(0)
  await expectAccessible(page)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Esci e salva la sessione' })).toBeVisible()
})

test('pomodoro starts, hides the clock and keeps running on other screens', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications'])
  await page.goto('/#/pomodoro')
  await page.getByRole('button', { name: 'Inizia' }).click()
  await expect(page.getByRole('heading', { name: 'Concentrazione' })).toBeVisible()
  await expect(page.getByText(/^\d+:\d\d$/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostra il tempo' }).click()
  await expect(page.getByText(/^2[45]:\d\d$/)).toBeVisible()
  await expectAccessible(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Pomodoro in corso/ })).toBeVisible()
})
