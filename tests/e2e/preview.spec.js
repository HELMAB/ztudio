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

test('the image gizmo appears on focus and its handles rotate and resize the clip', async ({
  page,
}) => {
  // No gizmo while the caption layer has focus.
  await expect(page.getByTestId('image-gizmo')).toHaveCount(0)

  // Focus the image layer via its timeline clip.
  await page
    .getByTestId('image-clip')
    .first()
    .click({ position: { x: 10, y: 5 } })
  await expect(page.getByTestId('image-gizmo')).toBeVisible()

  // Drag the rotate handle sideways: rotation moves off 0.
  expect(await state(page, 'selectedImage.rotation')).toBe(0)
  const rot = await page.getByTestId('gizmo-rotate').boundingBox()
  await page.mouse.move(rot.x + rot.width / 2, rot.y + rot.height / 2)
  await page.mouse.down()
  await page.mouse.move(rot.x + 140, rot.y + 140, { steps: 6 })
  await page.mouse.up()
  expect(await state(page, 'selectedImage.rotation')).not.toBe(0)

  // Drag a corner handle outward (away from the canvas centre): zoom grows.
  const before = await state(page, 'selectedImage.zoom')
  const canvas = await page.getByTestId('preview-canvas').boundingBox()
  const centre = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }
  const corner = await page.getByTestId('gizmo-corner').first().boundingBox()
  const cx = corner.x + corner.width / 2
  const cy = corner.y + corner.height / 2
  const len = Math.hypot(cx - centre.x, cy - centre.y) || 1
  const out = { x: cx + ((cx - centre.x) / len) * 80, y: cy + ((cy - centre.y) / len) * 80 }
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(out.x, out.y, { steps: 6 })
  await page.mouse.up()
  expect(await state(page, 'selectedImage.zoom')).toBeGreaterThan(before)
})
