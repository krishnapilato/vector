import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

const fixture = fileURLToPath(new URL('./fixtures/manual.pdf', import.meta.url))

async function importFixture(page: Page) {
  await page.goto('/#/libreria')
  await page.getByLabel('File PDF, testo o Markdown').setInputFiles(fixture)
  await page.getByLabel('Titolo (facoltativo)').fill('Manuale di prova')
  await page.getByRole('button', { name: 'Importa' }).click()
  await expect(page.getByText(/Importato: 3 pagine, 3 capitoli/)).toBeVisible()
}

/** Selects the given text inside the reader as a user would by dragging. */
async function selectText(page: Page, text: string) {
  await expect(page.locator('article')).toContainText(text)
  await page.evaluate((needle) => {
    const article = document.querySelector('article') as HTMLElement
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent?.indexOf(needle) ?? -1
      if (i >= 0) {
        const range = document.createRange()
        range.setStart(n, i)
        range.setEnd(n, i + needle.length)
        const sel = window.getSelection() as Selection
        sel.removeAllRanges()
        sel.addRange(range)
        article.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        return
      }
    }
    throw new Error(`not found: ${needle}`)
  }, text)
}

test('import a PDF, read, highlight, take notes and search', async ({ page }) => {
  await importFixture(page)
  await expect(page.getByRole('link', { name: 'Manuale di prova' })).toBeVisible()
  await expect(page.getByText(/3 pagine · 3 capitoli/)).toBeVisible()

  await page.getByRole('link', { name: 'Inizia a leggere' }).click()
  await expect(page.getByText(/Lift is the force/)).toBeVisible()
  await expect(page.getByText('Chapter 1 Aerodynamics', { exact: false }).first()).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  // Highlight survives a reload.
  await selectText(page, 'critical angle of attack')
  await page.getByRole('button', { name: 'Evidenzia' }).click()
  await expect(page.locator('mark', { hasText: 'critical angle of attack' })).toBeVisible()
  await page.reload()
  await expect(page.locator('mark', { hasText: 'critical angle of attack' })).toBeVisible()

  // A note on a selection.
  await selectText(page, 'relative wind')
  await page.getByRole('button', { name: 'Nota' }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Vento relativo: opposto alla traiettoria')
  await page.getByRole('button', { name: 'Salva' }).click()
  await page.getByRole('button', { name: 'Note' }).click()
  await expect(page.getByText('Vento relativo: opposto alla traiettoria')).toBeVisible()
  await page.keyboard.press('Escape')

  // Arrow keys turn pages; the table of contents jumps.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(/METAR is a routine/)).toBeVisible()
  await page.getByRole('button', { name: 'Indice' }).click()
  await page.getByRole('button', { name: /Chapter 3 Navigation/ }).click()
  await expect(page.getByText(/Magnetic variation/)).toBeVisible()

  // Search across the book.
  await page.getByRole('button', { name: 'Cerca' }).click()
  await page.getByLabel('Testo da cercare').fill('dew point')
  await expect(page.getByText('1 risultati')).toBeVisible()
  await page.getByRole('button', { name: /Pagina 2/ }).click()
  await expect(page.getByText(/Fog forms/)).toBeVisible()

  // Original page view renders the PDF.
  await page.getByRole('button', { name: 'Vista pagina' }).click()
  await expect(page.getByRole('img', { name: 'Pagina 2 del PDF originale' })).toBeVisible()

  // Back in the library, progress is remembered.
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page.getByRole('link', { name: 'Riprendi da pagina 2' })).toBeVisible()
})

test('glossary from the reader', async ({ page }) => {
  await importFixture(page)
  await page.getByRole('link', { name: 'Inizia a leggere' }).click()
  await selectText(page, 'stall')
  await page.getByRole('button', { name: 'Glossario' }).click()
  await expect(page.getByRole('complementary', { name: 'Glossario' })).toBeVisible()
  await expect(page.getByText('stallo', { exact: false }).first()).toBeVisible()
})

test('question generation asks for a key', async ({ page }) => {
  await importFixture(page)
  await page.getByRole('link', { name: 'Inizia a leggere' }).click()
  await page.getByRole('button', { name: 'Crea domande' }).click()
  await expect(page.getByText(/serve la tua chiave Google AI Studio/)).toBeVisible()
})

test('pen notes on the original page, eraser, undo, transcription', async ({ page }) => {
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().url().includes(':generateContent')) {
      const body = route.request().postDataJSON()
      // Only the handwriting is sent, as an image, never the page text.
      expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/png')
      await route.fulfill({
        json: {
          candidates: [
            { content: { parts: [{ text: 'Vento relativo = opposto alla traiettoria' }] } },
          ],
        },
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

  await importFixture(page)
  await page.getByRole('link', { name: 'Inizia a leggere' }).click()
  await page.getByRole('button', { name: 'Vista pagina' }).click()
  const pageImg = page.getByRole('img', { name: 'Pagina 1 del PDF originale' })
  await expect(pageImg).toBeVisible()
  await page.getByRole('button', { name: 'Penna' }).click()
  await expect(page.getByRole('button', { name: 'Penna' })).toHaveAttribute('aria-pressed', 'true')

  await expect(page.locator('svg.absolute')).toBeAttached()
  const box = await pageImg.boundingBox()
  if (!box) throw new Error('no page')
  const draw = async (y: number) => {
    await page.mouse.move(box.x + 60, box.y + y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(box.x + 60 + i * 15, box.y + y + (i % 2) * 6)
    await page.mouse.up()
  }
  const strokes = page.locator('svg path')
  await draw(120)
  await expect(strokes).toHaveCount(1)
  await draw(180)
  await expect(strokes).toHaveCount(2)

  // Persisted.
  await page.reload()
  await expect(page.locator('svg path')).toHaveCount(2)

  // Eraser removes one, undo brings it back.
  await page.getByRole('button', { name: 'Gomma' }).click()
  await page.mouse.click(box.x + 120, box.y + 183)
  await expect(strokes).toHaveCount(1)
  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(strokes).toHaveCount(2)

  await page.getByRole('button', { name: 'Trascrivi in testo (IA)' }).click()
  await expect(page.getByText('Vento relativo = opposto alla traiettoria')).toBeVisible()
  await page.getByRole('button', { name: 'Note', exact: true }).click()
  await expect(
    page.getByRole('complementary').getByText('Vento relativo = opposto alla traiettoria'),
  ).toBeVisible()
})
