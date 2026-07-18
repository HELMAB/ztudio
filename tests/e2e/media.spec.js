import { expect, test } from '@playwright/test'
import { boot, DEMO, selectOption, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

// The Media panel is the left aside; its icon rail switches sections.
const mediaPanel = page => page.getByTestId('media-panel')

test('changes the output resolution', async ({ page }) => {
  // Resolution lives in the rail's Settings section.
  const panel = mediaPanel(page)
  await panel.getByRole('tab', { name: 'Settings', exact: true }).click()
  await selectOption(page, panel, 'Aspect & resolution', '1920 × 1080 — Full HD 1080p (16:9)')
  await expect.poll(() => state(page, 'resolution')).toBe('1920x1080')
})

test('changes export quality, format and fps in the export dialog', async ({ page }) => {
  // The options moved out of the Media panel into the pre-export settings dialog.
  await page.getByTestId('export-button').click()
  const dialog = page.getByTestId('export-dialog')
  await expect(dialog).toBeVisible()

  await selectOption(page, dialog, 'Format', 'WebM')
  await expect.poll(() => state(page, 'exportSettings.format')).toBe('webm')

  await selectOption(page, dialog, 'FPS', '60 fps')
  await expect.poll(() => state(page, 'exportSettings.fps')).toBe(60)

  await selectOption(page, dialog, 'Quality', 'Very High')
  await expect.poll(() => state(page, 'exportSettings.quality')).toBe('veryhigh')

  // Closing the dialog must not kick off a render.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  expect(await state(page, 'busy')).toBe(false)
})

test('lists every loaded medium in the Assets tab and removes captions from it', async ({ page }) => {
  const panel = mediaPanel(page)
  await panel.getByRole('tab', { name: 'Assets', exact: true }).click()
  // Demo project: voice audio, one image clip, captions, logo → four rows.
  const rows = panel.getByTestId('asset-row')
  await expect(rows).toHaveCount(4)

  // Removing the captions row clears the cues and drops the row.
  expect(await state(page, 'cues.length')).toBeGreaterThan(0)
  await rows.nth(2).getByRole('button', { name: 'Remove file' }).click()
  await expect.poll(() => state(page, 'cues.length')).toBe(0)
  await expect(rows).toHaveCount(3)
})

test('imports mixed media through the Assets import input', async ({ page }) => {
  const panel = mediaPanel(page)
  await panel.getByRole('tab', { name: 'Assets', exact: true }).click()
  const before = await state(page, 'images.length')
  // One change event with an image + an srt routes each file to its loader.
  await panel.getByTestId('assets-import').setInputFiles([DEMO.image, DEMO.srt])
  await expect.poll(() => state(page, 'images.length')).toBe(before + 1)
  expect(await state(page, 'cues.length')).toBeGreaterThan(0)
})

test('clicking an image asset row selects that clip', async ({ page }) => {
  const panel = mediaPanel(page)
  await panel.getByRole('tab', { name: 'Assets', exact: true }).click()
  // Add a second image so selection has somewhere to move; the new clip is
  // auto-selected, so clicking the first image row (after the audio row)
  // moves selection back to the original clip.
  await panel.getByTestId('assets-import').setInputFiles(DEMO.image)
  await expect.poll(() => state(page, 'images.length')).toBe(2)
  await panel.getByTestId('asset-row').nth(1).click()
  const firstId = await state(page, 'images.0.id')
  await expect.poll(() => state(page, 'selectedImageId')).toBe(firstId)
})

test('uploads a custom caption font', async ({ page }) => {
  // Enable the custom-font uploader in the inspector Style tab.
  const inspector = page.getByTestId('inspector')
  await inspector.getByRole('tab', { name: 'Style', exact: true }).click()
  await inspector.getByText('Upload custom fonts').click()
  await inspector.locator('input[type="file"]').setInputFiles(DEMO.font)
  await expect.poll(() => state(page, 'customFonts.length')).toBeGreaterThan(0)
})
