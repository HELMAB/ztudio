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
  // At t=0 the caption layer has focus but no cue is on screen → no gizmo.
  await expect(page.getByTestId('preview-gizmo')).toHaveCount(0)

  // Focus the image layer via its timeline clip.
  await page
    .getByTestId('image-clip')
    .first()
    .click({ position: { x: 10, y: 5 } })
  await expect(page.getByTestId('preview-gizmo')).toBeVisible()

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

test('the caption gizmo rotates and resizes the caption style', async ({ page }) => {
  // Jump to the first cue: caption focus + a caption on screen → gizmo appears.
  await page.evaluate(() => window.__ztudio.goToCue(0))
  await expect(page.getByTestId('preview-gizmo')).toBeVisible()

  // Drag the rotate handle sideways: the global caption rotation moves off 0.
  // hover() first: it waits for a stable layout, so the raw mouse coords that
  // follow can't be thrown off by panels still settling under parallel load.
  expect(await state(page, 'controls.captionRotation')).toBe(0)
  const rotHandle = page.getByTestId('gizmo-rotate')
  await rotHandle.hover()
  const rot = await rotHandle.boundingBox()
  await page.mouse.down()
  await page.mouse.move(rot.x + 140, rot.y + 140, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'controls.captionRotation')).not.toBe(0)

  // Drag a corner away from the caption block centre: the font size grows.
  const before = await state(page, 'controls.fontSizePct')
  await page.getByTestId('gizmo-corner').first().hover()
  const corners = await page.getByTestId('gizmo-corner').evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }),
  )
  const centre = {
    x: (corners[0].x + corners[3].x) / 2,
    y: (corners[0].y + corners[3].y) / 2,
  }
  const len = Math.hypot(corners[0].x - centre.x, corners[0].y - centre.y) || 1
  const out = {
    x: corners[0].x + ((corners[0].x - centre.x) / len) * 60,
    y: corners[0].y + ((corners[0].y - centre.y) / len) * 60,
  }
  await page.mouse.move(corners[0].x, corners[0].y)
  await page.mouse.down()
  await page.mouse.move(out.x, out.y, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'controls.fontSizePct')).toBeGreaterThan(before)
})

test('the title gizmo rotates and resizes the selected title', async ({ page }) => {
  // The demo's seeded title is on screen at t=0; focusing it shows the gizmo.
  await page.evaluate(() => window.__ztudio.selectText(window.__ztudio.texts[0].id))
  await expect(page.getByTestId('preview-gizmo')).toBeVisible()

  // Rotate handle → the title's own rotation.
  expect(await state(page, 'texts.0.rotation')).toBe(0)
  const rotHandle = page.getByTestId('gizmo-rotate')
  await rotHandle.hover()
  const rot = await rotHandle.boundingBox()
  await page.mouse.down()
  await page.mouse.move(rot.x + 140, rot.y + 140, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'texts.0.rotation')).not.toBe(0)

  // Corner outward → the title's own font size grows.
  const before = await state(page, 'texts.0.fontSizePct')
  await page.getByTestId('gizmo-corner').first().hover()
  const corners = await page.getByTestId('gizmo-corner').evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }),
  )
  const centre = {
    x: (corners[0].x + corners[3].x) / 2,
    y: (corners[0].y + corners[3].y) / 2,
  }
  const len = Math.hypot(corners[0].x - centre.x, corners[0].y - centre.y) || 1
  const out = {
    x: corners[0].x + ((corners[0].x - centre.x) / len) * 60,
    y: corners[0].y + ((corners[0].y - centre.y) / len) * 60,
  }
  await page.mouse.move(corners[0].x, corners[0].y)
  await page.mouse.down()
  await page.mouse.move(out.x, out.y, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'texts.0.fontSizePct')).toBeGreaterThan(before)
})

test('the logo gizmo rotates and resizes the logo', async ({ page }) => {
  // Focus the logo layer (as the timeline clip / asset row click does).
  await page.evaluate(() => window.__ztudio.selectLogo())
  await expect.poll(() => state(page, 'dragTarget')).toBe('logo')
  await expect(page.getByTestId('preview-gizmo')).toBeVisible()

  // Rotate handle → logo.rotation.
  expect(await state(page, 'logo.rotation')).toBe(0)
  const rotHandle = page.getByTestId('gizmo-rotate')
  await rotHandle.hover()
  const rot = await rotHandle.boundingBox()
  await page.mouse.down()
  await page.mouse.move(rot.x + 140, rot.y + 140, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'logo.rotation')).not.toBe(0)

  // Corner outward → logo scale grows (clamped to the slider range).
  const before = await state(page, 'logo.scalePct')
  await page.getByTestId('gizmo-corner').first().hover()
  const corners = await page.getByTestId('gizmo-corner').evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }),
  )
  const centre = {
    x: (corners[0].x + corners[3].x) / 2,
    y: (corners[0].y + corners[3].y) / 2,
  }
  const len = Math.hypot(corners[0].x - centre.x, corners[0].y - centre.y) || 1
  const out = {
    x: corners[0].x + ((corners[0].x - centre.x) / len) * 60,
    y: corners[0].y + ((corners[0].y - centre.y) / len) * 60,
  }
  await page.mouse.move(corners[0].x, corners[0].y)
  await page.mouse.down()
  await page.mouse.move(out.x, out.y, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => state(page, 'logo.scalePct')).toBeGreaterThan(before)
})
