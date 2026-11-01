// Generates e2e/fixtures/manual.pdf: a small book with an outline, used by the reader tests.
import { chromium } from 'playwright'

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:14pt serif;margin:2cm} h1{page-break-before:always} h1:first-child{page-break-before:avoid}
</style></head><body>
<h1>Chapter 1 Aerodynamics</h1>
<p>Lift is the force that acts perpendicular to the relative wind. The angle of attack is the angle between the chord line and the relative wind.</p>
<p>When the critical angle of attack is exceeded the airflow separates from the upper surface and the wing will stall.</p>
<h1>Chapter 2 Meteorology</h1>
<p>A METAR is a routine aviation weather report issued every thirty minutes or every hour.</p>
<p>Fog forms when the air cools to its dew point near the ground.</p>
<h1>Chapter 3 Navigation</h1>
<p>Magnetic variation is the angle between true north and magnetic north.</p>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html)
await page.pdf({ path: 'e2e/fixtures/manual.pdf', format: 'A5', outline: true, tagged: true })
await browser.close()
