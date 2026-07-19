import { expect, test } from '@playwright/test'
import { boot, DEMO, state } from './helpers'

// Autosave → reload → Resume. Exercises the v2 project doc: the image asset
// library persists separately from the timeline clips, so an unplaced upload
// and a placed clip both survive a reload.
test('assets and clips survive an autosave reload', async ({ page }) => {
  await boot(page)
  const panel = page.getByTestId('media-panel')
  await panel.getByRole('tab', { name: 'Assets', exact: true }).click()
  // Upload a second image but do NOT place it on the timeline.
  await panel.getByTestId('assets-import').setInputFiles(DEMO.image)
  await expect.poll(() => state(page, 'imageAssets.length')).toBe(2)
  expect(await state(page, 'images.length')).toBe(1)
  // Wait for the debounced autosave to land.
  await expect.poll(() => state(page, 'autosaveStatus'), { timeout: 15_000 }).toBe('saved')

  // Reload: the restore prompt appears (saved project found); resume it.
  await page.reload()
  await page.getByRole('button', { name: 'Resume', exact: true }).click({ timeout: 30_000 })
  await expect.poll(() => state(page, 'imageAssets.length'), { timeout: 15_000 }).toBe(2)

  // The placed demo clip came back attached to its asset; the upload is still
  // unplaced (nothing was auto-inserted by the restore).
  expect(await state(page, 'images.length')).toBe(1)
  const clip = await page.evaluate(() => {
    const im = window.__ztudio.images[0]
    return { assetId: im.assetId, hasBitmap: !!im.bitmap, start: im.start, end: im.end }
  })
  expect(clip.hasBitmap).toBe(true)
  expect(clip.assetId).toBeTruthy()
  expect(clip.end).toBeGreaterThan(clip.start)
})
