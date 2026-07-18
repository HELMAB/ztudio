import { expect, test } from '@playwright/test'
import { boot, DEMO, field, inspectorTab, nudgeSlider, selectOption, state } from './helpers'

// The demo loads one image clip, so the per-clip controls are available.
test.beforeEach(async ({ page }) => {
  await boot(page)
  await inspectorTab(page, 'Image')
})

test('changes the scene background fill mode', async ({ page }) => {
  await selectOption(page, page.getByTestId('inspector'), 'Background fill', 'Black')
  expect(await state(page, 'controls.bgMode')).toBe('black')
})

test('changes the selected image fit and effect', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  await selectOption(page, inspector, 'Image fit', 'Cover (fill, crop)')
  expect(await state(page, 'selectedImage.fit')).toBe('cover')

  await selectOption(page, inspector, 'Image effect', 'Noir')
  expect(await state(page, 'selectedImage.effect')).toBe('noir')
})

test('zooms the selected image via the slider', async ({ page }) => {
  const before = await state(page, 'selectedImage.zoom')
  await nudgeSlider(page, page.getByTestId('inspector'), 'Image zoom', 'right', 3)
  expect(await state(page, 'selectedImage.zoom')).toBeGreaterThan(before)
})

test('rotates the selected image via the slider', async ({ page }) => {
  expect(await state(page, 'selectedImage.rotation')).toBe(0)
  await nudgeSlider(page, page.getByTestId('inspector'), 'Image rotation', 'right', 3)
  expect(await state(page, 'selectedImage.rotation')).toBeGreaterThan(0)
})

test('toggling crop reveals the crop sliders', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  await field(inspector, 'Crop image').getByRole('switch').click()
  await expect(field(inspector, 'Crop top')).toBeVisible()
})

test('uploads a logo and exposes its framing controls', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  // Logo controls live at the bottom of the Image tab; the active tab mounts the
  // only file input here, so scope to the inspector.
  await inspector.locator('input[type="file"]').setInputFiles(DEMO.logo)
  await expect.poll(() => state(page, 'hasLogo')).toBe(true)
  // The logo position control appears once a logo is present.
  await expect(field(inspector, 'Position').first()).toBeVisible()
})
