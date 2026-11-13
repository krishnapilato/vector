import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Capture the built app with clean browser storage; never includes personal sessions.
const port = 4174
const base = `http://localhost:${port}/vector/`
const server = spawn(process.execPath, ['scripts/serve-dist.mjs', String(port)], {
  stdio: 'ignore',
  windowsHide: true,
})
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true
        break
      }
    } catch {
      /* Server is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!ready) throw new Error('Screenshot server did not start. Run pnpm build first.')
  await mkdir('docs/screenshots', { recursive: true })
  browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  await page.goto(base)
  await page.getByRole('button', { name: 'Start', exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'docs/screenshots/focus-desktop.png' })
  await page.goto(`${base}settings`)
  await page.getByRole('radio', { name: 'Data', exact: true }).check()
  await page.getByLabel('Import backup', { exact: true }).waitFor({ state: 'attached' })
  await page.screenshot({ path: 'docs/screenshots/settings-data.png' })
  // Demo records exist only in this disposable browser context.
  await page.evaluate(async () => {
    const now = Date.now()
    const request = indexedDB.open('vector')
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction('sessions', 'readwrite')
    const records = [
      {
        id: 'demo-reading',
        tag: 'Reading & reflection',
        minutes: 45,
        clarity: 4,
        note: 'Finished the chapter. Revisit the examples tomorrow.',
      },
      {
        id: 'demo-planning',
        tag: 'A little room to think',
        minutes: 25,
        clarity: 5,
        note: 'Outlined the next steps and cleared the distractions.',
      },
    ]
    for (const [index, record] of records.entries()) {
      tx.objectStore('sessions').put({
        id: record.id,
        tag: record.tag,
        startedAt: now - (index + 1) * 3_600_000,
        endedAt: now - (index + 1) * 3_600_000 + record.minutes * 60_000,
        activeSeconds: record.minutes * 60,
        pauseCount: 0,
        cameraUsed: false,
        focusAggregates: null,
        clarityRating: record.clarity,
        note: record.note,
      })
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  await page.goto(`${base}logbook`)
  await page.getByRole('heading', { name: 'Reading & reflection', exact: true }).waitFor()
  await page.screenshot({ path: 'docs/screenshots/logbook-desktop.png' })
  await page.setViewportSize({ width: 390, height: 1170 })
  await page.goto(base)
  await page.getByRole('button', { name: 'Start', exact: true }).waitFor()
  await page.screenshot({ path: 'docs/screenshots/focus-mobile.png', fullPage: true })
  console.log('Screenshots saved in docs/screenshots/')
} finally {
  await browser?.close()
  server.kill()
}
