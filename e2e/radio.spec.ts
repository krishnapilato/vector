import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('radio: listen, read back, check', async ({ page }) => {
  await page.goto('/#/radio')
  await expect(page.getByRole('heading', { name: 'Radio' })).toBeVisible()
  await page.getByRole('button', { name: 'Transponder' }).click()
  await page.getByRole('button', { name: 'Mostra il testo' }).click()
  const atc = (await page.locator('p[lang="en"]').first().textContent()) ?? ''
  const code = /squawk (\d{4})/.exec(atc)?.[1]
  const callsign = atc.split(',')[0] ?? ''
  expect(code).toBeTruthy()

  await page.getByLabel('Collaziona il codice transponder.').fill(`Squawk ${code}, ${callsign}`)
  await page.getByRole('button', { name: 'Controlla' }).click()
  await expect(page.getByText('Collazione completa.')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByRole('button', { name: 'Prossimo' }).click()
  await page.getByRole('textbox').fill('Roger')
  await page.getByRole('button', { name: 'Controlla' }).click()
  await expect(page.getByText('Manca qualcosa.')).toBeVisible()
  await expect(page.getByText('Collazioni complete in questa sessione: 1 su 2')).toBeVisible()
})

test('METAR: download, decode and practice', async ({ page }) => {
  await page.route('https://aviationweather.gov/api/data/**', (route) =>
    route.fulfill({
      body: route.request().url().includes('/metar')
        ? 'METAR LIMC 011050Z 27012G25KT 4000 -RA BKN015 12/11 Q1008 NOSIG'
        : 'TAF LIMC 010500Z 0106/0212 27010KT 9999 SCT030 TEMPO 0112/0118 4000 TSRA BKN020CB',
      headers: { 'access-control-allow-origin': '*' },
    }),
  )
  await page.goto('/#/strumenti/meteo')
  await page.getByRole('button', { name: 'Scarica METAR e TAF' }).click()
  await expect(page.getByText('da 270° a 12 nodi, raffiche 25 nodi')).toBeVisible()
  await expect(page.getByText('indicativamente marginale')).toBeVisible()
  await expect(page.getByText('Temporaneamente 0112/0118')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByRole('tab', { name: 'Esercizio' }).click()
  const groups = page.locator('fieldset')
  const n = await groups.count()
  expect(n).toBeGreaterThan(1)
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole('button').first().click()
  await expect(page.getByText(new RegExp(`su ${n}\\.`))).toBeVisible()
})

test('glossary flashcards', async ({ page }) => {
  await page.goto('/#/strumenti/glossario')
  await expect(page.getByText(/Scheda 1 di 12/)).toBeVisible()
  await page.getByRole('button', { name: 'Gira la scheda' }).click()
  await page.getByRole('button', { name: 'Lo sapevo', exact: true }).click()
  await expect(page.getByText(/Scheda 2 di 12/)).toBeVisible()
  await page.getByRole('tab', { name: 'Cerca' }).click()
  await page.getByLabel('Termine in italiano o in inglese').fill('stall')
  await expect(page.getByText('stallo').first()).toBeVisible()
})
