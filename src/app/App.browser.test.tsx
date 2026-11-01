import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'
import '../styles/index.css'

test('renders the shell with menu and footer in a real browser', async () => {
  const screen = await render(<App />)
  await expect
    .element(screen.getByRole('heading', { name: 'Studia i concetti, non le risposte.' }))
    .toBeVisible()
  await expect.element(screen.getByRole('navigation', { name: 'Principale' })).toBeVisible()
  await expect.element(screen.getByText('I tuoi dati restano su questo dispositivo.')).toBeVisible()
})
