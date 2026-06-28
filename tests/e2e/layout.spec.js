import { expect, test } from '@playwright/test'
import { boot, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

// Drive a divider drag by dispatching the real pointer sequence the handle wires
// up (pointerdown on the handle, then pointermove/up on window). Deterministic
// under parallel load, where low-level synthesized mouse moves can be dropped.
async function dragHandle(page, testid, dx, dy) {
  await page.evaluate(
    ({ testid, dx, dy }) => {
      const el = document.querySelector(`[data-testid="${testid}"]`)
      const r = el.getBoundingClientRect()
      const x = r.x + r.width / 2
      const y = r.y + r.height / 2
      const ev = (type, cx, cy) =>
        new PointerEvent(type, { clientX: cx, clientY: cy, bubbles: true, pointerId: 1 })
      el.dispatchEvent(ev('pointerdown', x, y))
      window.dispatchEvent(ev('pointermove', x + dx, y + dy))
      window.dispatchEvent(ev('pointerup', x + dx, y + dy))
    },
    { testid, dx, dy },
  )
}

test('top-bar toggles collapse and restore the media panel', async ({ page }) => {
  await expect(page.getByTestId('inspector')).toBeVisible()
  expect(await state(page, 'layout.mediaOpen')).toBe(true)

  await page.getByTestId('toggle-media').click()
  await expect.poll(() => state(page, 'layout.mediaOpen')).toBe(false)
  await expect(page.getByTestId('media-expand')).toBeVisible()

  // The rail restores the panel too.
  await page.getByTestId('media-expand').click()
  await expect.poll(() => state(page, 'layout.mediaOpen')).toBe(true)
  await expect(page.getByTestId('media-expand')).toBeHidden()
})

test('top-bar toggles collapse and restore the inspector panel', async ({ page }) => {
  await page.getByTestId('toggle-inspector').click()
  await expect.poll(() => state(page, 'layout.inspectorOpen')).toBe(false)
  await expect(page.getByTestId('inspector')).toBeHidden()
  await expect(page.getByTestId('inspector-expand')).toBeVisible()

  await page.getByTestId('inspector-expand').click()
  await expect.poll(() => state(page, 'layout.inspectorOpen')).toBe(true)
  await expect(page.getByTestId('inspector')).toBeVisible()
})

test('dragging the media divider widens the panel', async ({ page }) => {
  const before = await state(page, 'layout.mediaWidth')
  await dragHandle(page, 'resize-media', 80, 0)
  await expect.poll(() => state(page, 'layout.mediaWidth')).toBeGreaterThan(before)
})

test('dragging the timeline divider upward grows its height', async ({ page }) => {
  const before = await state(page, 'layout.timelineHeight')
  await dragHandle(page, 'resize-timeline', 0, -60)
  await expect.poll(() => state(page, 'layout.timelineHeight')).toBeGreaterThan(before)
})
