import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('a second profile starts from zero, in English, for another exam', async ({ page }) => {
  // The first profile has some history.
  await page.goto('/#/studia?anticipo')
  const reveal = page.getByRole('button', { name: 'Mostra le opzioni' })
  if (await reveal.isVisible()) await reveal.click()
  await page.getByRole('button', { name: /Non lo so/ }).click()

  await page.goto('/#/impostazioni')
  await page.getByRole('link', { name: 'Profili: più persone su questo dispositivo' }).click()
  await expect(page.getByRole('heading', { name: 'Profili' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).last().fill('Sara')
  await page.getByLabel('Lingua dell’interfaccia').selectOption('en')
  await page.getByLabel('Un altro esame: materie tue, domande dai tuoi libri').check()
  await page.getByLabel('Nome dell’esame').fill('Bar exam')
  await page.getByRole('button', { name: 'Crea e apri' }).click()

  // New profile: English interface, no aviation, nothing studied.
  await expect(page.getByRole('heading', { name: 'Study concepts, not answers.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Radio' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Sara' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.getByRole('link', { name: 'Subjects' }).click()
  await expect(page.getByRole('link', { name: 'EASA syllabus' })).toHaveCount(0)
  await page.getByLabel('New subject').fill('Contract law')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('link', { name: /Contract law/ })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByRole('link', { name: 'Tools' }).click()
  await expect(page.getByRole('link', { name: 'Calculator' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wind' })).toHaveCount(0)
  await page
    .getByLabel(/Calculation|Calcolo/)
    .first()
    .fill('1/0')
  await expect(page.getByText('Division by zero.')).toBeVisible()

  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByText('Nothing yet: answer a few questions and come back.')).toBeVisible()

  // Back to the first profile: Italian, and its history is still there.
  await page.goto('/#/profili')
  await page.getByRole('button', { name: 'Use this profile' }).click()
  await expect(
    page.getByRole('heading', { name: 'Studia i concetti, non le risposte.' }),
  ).toBeVisible()
  await page.goto('/#/profilo')
  await expect(page.getByText('Risposte date')).toBeVisible()
})

test('English interface on the PPL course', async ({ page }) => {
  await page.goto('/#/impostazioni')
  await page.getByLabel('Lingua dell’interfaccia').selectOption('en')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.goto('/#/radio')
  await page.getByRole('button', { name: 'Transponder' }).click()
  await expect(page.getByText(/in contact with/)).toBeVisible()
  await page.goto('/#/strumenti/meteo')
  await page
    .getByLabel('Or paste a METAR or TAF')
    .fill('METAR LIMC 011050Z 27012G25KT 9999 BKN015 12/11 Q1008 NOSIG')
  await expect(page.getByText('from 270° at 12 knots, gusting 25 knots')).toBeVisible()
  await page.goto('/#/materie')
  await expect(page.getByText('Principles of flight')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
