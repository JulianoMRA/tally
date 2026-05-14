import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

test('opens app window with title Tally', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '../out/main/index.cjs')]
  })

  const window = await app.firstWindow()
  const title = await window.title()

  expect(title).toBe('Tally')

  await app.close()
})
