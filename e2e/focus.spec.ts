import { expect, test } from '@playwright/test'

test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera', 'microphone'],
})

test('focus settings ask for the camera and the session survives without models', async ({
  page,
}) => {
  // The vision models live on Google storage: blocked here, as on a flaky connection.
  await page.route('https://storage.googleapis.com/**', (r) => r.abort())
  await page.goto('/#/impostazioni')
  await page.getByLabel('Usa la fotocamera').click()
  await expect(page.getByLabel('Usa la fotocamera')).toBeChecked()
  await expect(page.getByLabel('Accorgiti del telefono in mano')).toBeVisible()
  await page.getByLabel('Usa il microfono').click()
  await expect(
    page.getByLabel('Studio ad alta voce: la mia voce non è una distrazione'),
  ).toBeVisible()

  await page.goto('/#/studia?anticipo')
  await expect(page.getByText(/non riesco ad avviare fotocamera o microfono/i)).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('profile page explains what is known and can forget it', async ({ page }) => {
  await page.goto('/#/profilo')
  await expect(page.getByRole('heading', { name: 'Cosa so di te' })).toBeVisible()
  await expect(page.getByText('Ancora niente')).toBeVisible()

  // One answer, then the profile shows it.
  await page.goto('/#/studia?anticipo')
  const reveal = page.getByRole('button', { name: 'Mostra le opzioni' })
  if (await reveal.isVisible()) await reveal.click()
  await page.getByRole('button', { name: /Non lo so/ }).click()
  await page.goto('/#/profilo')
  await expect(page.getByText('Risposte date')).toBeVisible()
  await page.getByRole('button', { name: 'Dimentica tutto questo' }).click()
  await page.getByRole('button', { name: /Conferma: dimentica/ }).click()
  await expect(page.getByText('Ancora niente')).toBeVisible()
})
