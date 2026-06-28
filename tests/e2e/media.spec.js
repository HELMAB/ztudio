import { expect, test } from '@playwright/test'
import { boot, DEMO, selectOption, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

// The Media panel is the left aside (contains the resolution control).
const mediaPanel = page => page.locator('aside').filter({ hasText: 'Aspect & resolution' })

test('changes the output resolution', async ({ page }) => {
  await selectOption(
    page,
    mediaPanel(page),
    'Aspect & resolution',
    '1920 × 1080 — YouTube (16:9)',
  )
  await expect.poll(() => state(page, 'resolution')).toBe('1920x1080')
})

test('changes export quality, format and fps', async ({ page }) => {
  const panel = mediaPanel(page)
  await selectOption(page, panel, 'Format', 'WebM')
  await expect.poll(() => state(page, 'exportSettings.format')).toBe('webm')

  await selectOption(page, panel, 'FPS', '60 fps')
  await expect.poll(() => state(page, 'exportSettings.fps')).toBe(60)
})

test('uploads an additional image as a new clip', async ({ page }) => {
  const before = await state(page, 'images.length')
  // Switch the Media panel to its Image tab, then upload via its file input.
  const panel = mediaPanel(page)
  await panel.getByRole('tab', { name: 'Image', exact: true }).click()
  await panel.locator('input[type="file"]').setInputFiles(DEMO.image)
  await expect.poll(() => state(page, 'images.length')).toBe(before + 1)
})

test('uploads a custom caption font', async ({ page }) => {
  // Enable the custom-font uploader in the inspector Style tab.
  const inspector = page.getByTestId('inspector')
  await inspector.getByRole('tab', { name: 'Style', exact: true }).click()
  await inspector.getByText('Upload custom fonts').click()
  await inspector.locator('input[type="file"]').setInputFiles(DEMO.font)
  await expect.poll(() => state(page, 'customFonts.length')).toBeGreaterThan(0)
})
