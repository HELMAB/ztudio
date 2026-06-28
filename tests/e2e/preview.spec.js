import { expect, test } from '@playwright/test'
import { boot, inspectorTab, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

test('focusing a layer makes it the preview drag/resize target', async ({ page }) => {
  // The manual Caption/Image/Title toggle is gone — focus drives the target now.
  await expect(page.getByRole('group', { name: 'Drag target' })).toHaveCount(0)

  // Default focus is the caption layer.
  expect(await state(page, 'dragTarget')).toBe('caption')

  // Selecting the image clip focuses the image layer.
  await page
    .getByTestId('image-clip')
    .first()
    .click({ position: { x: 10, y: 5 } })
  await expect.poll(() => state(page, 'dragTarget')).toBe('image')

  // Selecting a caption (via the cue list) focuses the caption layer again.
  await inspectorTab(page, 'Cues')
  await page.getByTestId('cue-list').getByTestId('cue-text').first().click()
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
    .poll(() =>
      page.evaluate(() => window.__ztudio.logEntries.some(e => /Thumbnail saved/.test(e))),
    )
    .toBe(true)
})
