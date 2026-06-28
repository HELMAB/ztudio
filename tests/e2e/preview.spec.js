import { expect, test } from '@playwright/test'
import { boot, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

test('the drag-target toggle switches the active layer', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Drag target' })
  // Demo has an image, so the Image target is offered.
  await group.getByRole('button', { name: 'Image', exact: true }).click()
  await expect.poll(() => state(page, 'dragTarget')).toBe('image')

  await group.getByRole('button', { name: 'Caption', exact: true }).click()
  await expect.poll(() => state(page, 'dragTarget')).toBe('caption')
})

test('the safe-area guide toggles (aria-pressed)', async ({ page }) => {
  const safe = page.getByRole('button', { name: 'Safe area guide' })
  await expect(safe).toHaveAttribute('aria-pressed', 'false')
  await safe.click()
  await expect(safe).toHaveAttribute('aria-pressed', 'true')
})

test('exports a still thumbnail', async ({ page }) => {
  await page.getByRole('button', { name: 'Frame', exact: true }).click()
  // The thumbnail is drawn and saved; the store logs the result.
  await expect
    .poll(() => page.evaluate(() => window.__ztudio.logEntries.some(e => /Thumbnail saved/.test(e))))
    .toBe(true)
})
