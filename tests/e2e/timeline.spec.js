import { expect, test } from '@playwright/test'
import { boot, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

test('zoom in / out / fit change the timeline zoom', async ({ page }) => {
  const base = await state(page, 'timelineZoom')

  await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoomedIn = await state(page, 'timelineZoom')
  expect(zoomedIn).toBeGreaterThan(base)

  await page.getByRole('button', { name: 'Zoom out' }).click()
  expect(await state(page, 'timelineZoom')).toBeLessThan(zoomedIn)

  // Fit recomputes a zoom to frame the whole project.
  await page.getByRole('button', { name: 'Fit timeline' }).click()
  await expect.poll(() => state(page, 'timelineZoom')).toBeGreaterThan(0)
})

test('snap toggle flips the snap state', async ({ page }) => {
  const before = await state(page, 'snapEnabled')
  await page.getByRole('button', { name: 'Snapping' }).click()
  await expect.poll(() => state(page, 'snapEnabled')).toBe(!before)
})

test('the audio clip / waveform lane is rendered', async ({ page }) => {
  // The demo audio produces an "audio · Ns" clip on the timeline.
  await expect(page.getByText(/audio ·/).first()).toBeVisible()
})
