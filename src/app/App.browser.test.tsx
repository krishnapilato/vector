import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'
import '../styles/index.css'

test('renders the shell in a real browser', async () => {
  const screen = await render(<App />)
  await expect.element(screen.getByRole('heading', { name: 'vector' })).toBeVisible()
  await expect.element(screen.getByText(/timer richiamo 30 s/)).toBeVisible()
})
