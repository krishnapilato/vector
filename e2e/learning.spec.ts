import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/** A fake Gemini: the real one is never called from tests. */
async function fakeGemini(page: Page, reply: (prompt: string) => object) {
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url()
    if (url.includes(':generateContent')) {
      const prompt: string = route.request().postDataJSON().contents[0].parts[0].text
      await route.fulfill({
        json: { candidates: [{ content: { parts: [{ text: JSON.stringify(reply(prompt)) }] } }] },
      })
    } else {
      await route.fulfill({
        json: {
          models: [
            { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
          ],
        },
      })
    }
  })
  await page.goto('/#/impostazioni')
  await page.getByLabel('Chiave API di Google AI Studio').fill('test-key-not-real')
  await page.getByRole('button', { name: 'Verifica e salva' }).click()
  await expect(page.getByText(/Chiave valida/)).toBeVisible()
}

test('open question without AI: honest self-check, then the diary', async ({ page }) => {
  await page.goto('/#/spiega')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confronta con i punti chiave' })).toBeDisabled()
  await page.getByLabel('La tua spiegazione').fill('Non ricordo bene, forse riguarda la pista.')
  await page.getByRole('button', { name: 'Confronta con i punti chiave' }).click()
  await page.getByRole('button', { name: 'Fatto' }).click()
  await expect(page.getByText(/Sbagliata|Non sapevo|non/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Un altro concetto' })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.goto('/#/errori')
  await expect(page.getByRole('heading', { name: 'Diario degli errori' })).toBeVisible()
  await expect(page.getByText('1 concetto da sistemare')).toBeVisible()
  await page.getByRole('button', { name: 'Rileggi il testo' }).click()
  await expect(page.getByRole('button', { name: 'Nascondi il testo' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('open question with guided correction', async ({ page }) => {
  let call = 0
  await fakeGemini(page, (prompt) => {
    const points = prompt.split('\n').filter((l) => /^\d+\. /.test(l)).length
    call++
    // The first answer gets only the first point; the second completes the rest.
    return call === 1
      ? {
          covered: Array.from({ length: points }, (_, i) => i === 0),
          mistakes: [],
          hint: 'Cosa succede alla velocità?',
        }
      : { covered: Array.from({ length: points }, (_, i) => i > 0), mistakes: [], hint: null }
  })
  await page.goto('/#/spiega?materia=met')
  await page.getByLabel('La tua spiegazione').fill('Una prima spiegazione abbastanza lunga.')
  await page.getByRole('button', { name: 'Correggi' }).click()
  await expect(page.getByText('Cosa succede alla velocità?')).toBeVisible()
  await expect(page.getByText(/Hai centrato 1 punto su/)).toBeVisible()
  await page.getByRole('button', { name: 'Completa la risposta' }).click()
  await page.getByLabel('La tua spiegazione').fill('Aggiungo quello che mancava, con calma.')
  await page.getByRole('button', { name: 'Correggi' }).click()
  await expect(page.getByText('Giusta, ma non eri sicuro.')).toBeVisible()
})

test('program map shows EASA topics and coverage', async ({ page }) => {
  await page.goto('/#/materie')
  await page.getByRole('link', { name: 'Programma EASA' }).click()
  await expect(page.getByRole('heading', { name: 'Programma EASA' })).toBeVisible()
  await expect(page.getByText('Regole dell’aria (SERA)')).toBeVisible()
  await expect(page.getByText('scoperto').first()).toBeVisible()
  await page.getByRole('link', { name: 'Navigazione' }).click()
  await expect(page.getByText('Regole dell’aria (SERA)')).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
