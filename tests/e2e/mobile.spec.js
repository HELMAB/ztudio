import { expect, test } from '@playwright/test'
import { boot } from './helpers'

// Phones (below the lg breakpoint) render ZtudioMobileWorkspace: the preview is
// the hero, the side panels collapse into a bottom sheet, and the transport keeps
// only its essentials so the bar never wraps. A typical phone viewport.
test.use({ viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ page }) => {
  await boot(page)
})

test('renders the mobile workspace with a bottom tab bar', async ({ page }) => {
  const nav = page.locator('nav')
  await expect(nav.getByRole('button', { name: 'Media' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Caption' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Timeline' })).toBeVisible()
})

test('the transport keeps its essentials on a single row', async ({ page }) => {
  // Secondary controls drop out on mobile so the bar can't wrap into two rows.
  await expect(page.getByRole('button', { name: 'Go to start' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Go to end' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Frame', exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Safe area guide' })).toBeHidden()

  // The essentials stay reachable.
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible()

  // One row: the bar is no taller than a single control lane (no wrap overflow).
  const bar = page.getByTestId('transport-bar')
  const wraps = await bar.evaluate(el => el.scrollHeight > el.clientHeight + 4)
  expect(wraps).toBe(false)
})

test('a tab opens the bottom sheet; the grab handle closes it', async ({ page }) => {
  const timelineTab = page.locator('nav').getByRole('button', { name: 'Timeline' })

  // Collapsed by default: the preview owns the screen.
  await expect(timelineTab).toHaveAttribute('aria-expanded', 'false')

  await timelineTab.click()
  await expect(timelineTab).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('timeline-viewport')).toBeVisible()

  // The sheet's grab handle collapses it back to the maximised preview.
  await page.getByRole('button', { name: 'Collapse panel' }).click()
  await expect(timelineTab).toHaveAttribute('aria-expanded', 'false')
})
