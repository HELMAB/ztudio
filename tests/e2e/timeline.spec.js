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

test('seeking pulls the playhead back into view when zoomed in', async ({ page }) => {
  const viewport = page.getByTestId('timeline-viewport')
  // Zoom in so the track is several times wider than the viewport (scrollable).
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Zoom in' }).click()
  }
  await page.evaluate(() => window.__ztudio.seek(0))
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBe(0)

  // Jumping to the end pulls the viewport along to keep the playhead visible.
  await page.evaluate(() => window.__ztudio.seek(window.__ztudio.previewDuration))
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
})

test('zooming in keeps the playhead anchored on screen', async ({ page }) => {
  const viewport = page.getByTestId('timeline-viewport')
  // Park the playhead at the midpoint, then zoom in around it.
  await page.evaluate(() => window.__ztudio.seek(window.__ztudio.previewDuration / 2))
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Zoom in' }).click()
  }

  // Without anchoring the midpoint playhead would sit far right of a still-at-0
  // scroll; anchoring keeps it within the visible viewport.
  const onScreen = await viewport.evaluate(el => {
    const z = window.__ztudio
    const pps = el.scrollWidth / z.previewDuration
    const x = z.scrub * pps
    return x >= el.scrollLeft && x <= el.scrollLeft + el.clientWidth
  })
  expect(onScreen).toBe(true)
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

test('image clips render a filmstrip thumbnail', async ({ page }) => {
  const strip = page.getByTestId('image-clip-thumbs').first()
  await expect(strip).toBeVisible()
  const bg = await strip.evaluate(el => getComputedStyle(el).backgroundImage)
  expect(bg).toContain('data:image')
})
