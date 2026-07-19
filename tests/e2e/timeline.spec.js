import { expect, test } from '@playwright/test'
import { boot, DEMO, state } from './helpers'

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

test('clicking the ruler seeks the playhead', async ({ page }) => {
  expect(await state(page, 'scrub')).toBe(0)
  const ruler = page.getByTestId('timeline-ruler')
  // Locator click auto-waits for a stable position (raw mouse coords are flaky
  // under parallel-load layout settling).
  const box = await ruler.boundingBox()
  await ruler.click({ position: { x: Math.round(box.width * 0.5), y: 12 } })
  await expect.poll(() => state(page, 'scrub')).toBeGreaterThan(0)
})

test('dragging the playhead handle scrubs', async ({ page }) => {
  const handle = page.getByTestId('playhead-handle')
  await handle.hover()
  await page.mouse.down()
  const b = await handle.boundingBox()
  await page.mouse.move(b.x + 250, b.y + b.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'scrub')).toBeGreaterThan(1)
})

test('ctrl+wheel over the track zooms the timeline', async ({ page }) => {
  const before = await state(page, 'timelineZoom')
  await page.getByTestId('timeline-viewport').hover()
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await expect.poll(() => state(page, 'timelineZoom')).toBeGreaterThan(before)
})

test('dragging an image asset row onto the timeline re-places the clip', async ({ page }) => {
  const panel = page.getByTestId('media-panel')
  await panel.getByRole('tab', { name: 'Assets', exact: true }).click()
  // Import a second image: it gets a movable 3s slot at the playhead (the demo
  // image spans the whole timeline) and is auto-selected.
  await panel.getByTestId('assets-import').setInputFiles(DEMO.image)
  await expect.poll(() => state(page, 'images.length')).toBe(2)
  const clipId = await state(page, 'selectedImageId')

  // HTML5 drag: a shared DataTransfer carries the asset id from the row's
  // dragstart to the timeline viewport's dragover/drop.
  const dt = await page.evaluateHandle(() => new DataTransfer())
  await panel.getByTestId('asset-row').nth(2).dispatchEvent('dragstart', { dataTransfer: dt })
  const viewport = page.getByTestId('timeline-viewport')
  const box = await viewport.boundingBox()
  const clientX = Math.round(box.x + box.width * 0.6)
  const clientY = Math.round(box.y + box.height / 2)
  await viewport.dispatchEvent('dragover', { dataTransfer: dt, clientX, clientY })
  await expect(page.getByTestId('timeline-drop-line')).toBeVisible()
  await viewport.dispatchEvent('drop', { dataTransfer: dt, clientX, clientY })

  // The clip moved to ~60% of the duration, keeping its 3s length.
  const dur = await state(page, 'previewDuration')
  const clip = () =>
    page.evaluate(
      id =>
        window.__ztudio.images
          .map(im => ({ id: im.id, start: im.start, end: im.end }))
          .find(im => im.id === id),
      clipId,
    )
  await expect.poll(async () => (await clip()).start).toBeGreaterThan(dur * 0.4)
  const placed = await clip()
  expect(placed.end - placed.start).toBeCloseTo(3, 1)
  expect(await state(page, 'selectedImageId')).toBe(clipId)
  // The drop line clears once the drop lands.
  await expect(page.getByTestId('timeline-drop-line')).toBeHidden()
})

test('the toolbar zoom slider changes the zoom', async ({ page }) => {
  const before = await state(page, 'timelineZoom')
  const thumb = page.getByTestId('timeline-zoom').getByRole('slider')
  await thumb.click()
  await thumb.press('ArrowRight')
  await expect.poll(() => state(page, 'timelineZoom')).not.toBe(before)
})
