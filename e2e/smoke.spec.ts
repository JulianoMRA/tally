import { test, expect } from './fixtures/electron-app'

test('opens app window with title Tally', async ({ app }) => {
  const window = await app.firstWindow()
  const title = await window.title()

  expect(title).toBe('Tally')
})
