import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { type BlobMeta, handle } from '../src/core/sync/server'

async function answerOne(page: Page) {
  const reveal = page.getByRole('button', { name: 'Mostra le opzioni' })
  if (await reveal.isVisible()) await reveal.click()
  await page.getByRole('button', { name: /Non lo so/ }).click()
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true })

  test('menu folds away and nothing scrolls sideways', async ({ page }) => {
    await page.goto('/')
    const menu = page.getByRole('button', { name: 'Menu' })
    await expect(menu).toBeVisible()
    await expect(page.getByRole('link', { name: 'Libreria' })).toBeHidden()
    await menu.click()
    await page.getByRole('link', { name: 'Libreria' }).click()
    await expect(page.getByRole('heading', { name: 'Libreria' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Piano' })).toBeHidden()
    for (const path of [
      '/',
      '/#/libreria',
      '/#/impostazioni',
      '/#/strumenti',
      '/#/studia?anticipo',
      '/#/spiega',
    ]) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
})

test('"I have 5 minutes" sizes the session', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '5 min' }).click()
  await expect(page).toHaveURL(/domande=7/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('encrypted backup: download, reset, restore', async ({ page }) => {
  await page.goto('/#/studia?anticipo')
  await answerOne(page)
  await page.goto('/#/profilo')
  await expect(page.getByText('Risposte date')).toBeVisible()

  await page.goto('/#/impostazioni')
  const phrase = 'vela bussola nebbia quercia faro'
  await page.getByLabel('Frase segreta per il backup cifrato').fill(phrase)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Scarica un backup cifrato' }).click(),
  ])
  const file = await download.path()
  const text = await readFile(file, 'utf8')
  expect(text).toContain('"format":"encrypted"')
  expect(text).not.toContain('Risposte')
  expect(text).not.toContain('progress')

  await page.getByRole('button', { name: /Cancella tutti i dati/ }).click()
  await page.getByRole('button', { name: /Conferma/ }).click()
  await page.goto('/#/profilo')
  await expect(page.getByText('Ancora niente')).toBeVisible()

  await page.goto('/#/impostazioni')
  await page.getByLabel('Ripristina da un backup (sostituisce i dati qui)').setInputFiles(file)
  await page
    .getByLabel('Frase segreta per il backup cifrato')
    .fill('frase sbagliata ma lunga abbastanza')
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await expect(page.getByText(/Frase segreta sbagliata/)).toBeVisible()
  await page.getByLabel('Frase segreta per il backup cifrato').fill(phrase)
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click()
  await expect(page.getByText(/Backup ripristinato/)).toBeVisible()
  await page.goto('/#/profilo')
  await expect(page.getByText('Risposte date')).toBeVisible()
})

test('sync between two devices through the server, end-to-end encrypted', async ({ browser }) => {
  const data = new Map<string, { value: string; meta: BlobMeta }>()
  const seen: string[] = []
  const server = async (page: Page) =>
    page.route('https://sync.test/**', async (route) => {
      const r = route.request()
      if (r.method() === 'PUT') seen.push(r.postData() ?? '')
      const res = await handle(
        new Request(r.url(), {
          method: r.method(),
          headers: await r.allHeaders(),
          ...(r.method() === 'PUT' ? { body: r.postData() ?? '' } : {}),
        }),
        {
          allowedOrigin: '*',
          store: {
            get: async (k) => data.get(k) ?? null,
            put: async (k, value, meta) => void data.set(k, { value, meta }),
            delete: async (k) => void data.delete(k),
          },
        },
      )
      await route.fulfill({
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: Buffer.from(await res.arrayBuffer()),
      })
    })
  const phrase = 'stella gabbiano rotta ponte miele'

  const a = await (await browser.newContext()).newPage()
  await server(a)
  await a.goto('/#/studia?anticipo')
  await answerOne(a)
  await a.goto('/#/impostazioni')
  await a.getByLabel('Indirizzo del server').fill('https://sync.test')
  await a.getByLabel('Frase segreta', { exact: true }).fill(phrase)
  await a.getByRole('button', { name: 'Invia da qui' }).click()
  await expect(a.getByText('Inviato.')).toBeVisible({ timeout: 20_000 })
  expect(seen[0]).toContain('"format":"encrypted"')
  expect(seen[0]).not.toContain('conceptId')

  const b = await (await browser.newContext()).newPage()
  await server(b)
  await b.goto('/#/impostazioni')
  await b.getByLabel('Indirizzo del server').fill('https://sync.test')
  await b.getByLabel('Frase segreta', { exact: true }).fill(phrase)
  await b.getByRole('button', { name: /Ricevi/ }).click()
  await expect(b.getByText(/Ricevuto/)).toBeVisible({ timeout: 20_000 })
  await expect(b.getByText(/versione 1/)).toBeVisible()
  await b.goto('/#/profilo')
  await expect(b.getByText('Risposte date')).toBeVisible()

  // A stale device cannot overwrite newer data.
  await a.getByRole('button', { name: 'Invia da qui' }).click()
  await expect(a.getByText('Inviato.')).toBeVisible({ timeout: 20_000 })
  await b.goto('/#/impostazioni')
  await b.getByRole('button', { name: 'Invia da qui' }).click()
  await expect(b.getByText(/ricevili prima di inviare/)).toBeVisible({ timeout: 20_000 })
})
