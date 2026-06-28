import { expect, test } from '@playwright/test'
import { boot, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

const btn = (page, name) => page.getByRole('button', { name, exact: true })

test('skip to end and back to start', async ({ page }) => {
  await btn(page, 'Go to end').click()
  await expect.poll(() => state(page, 'scrub')).toBeGreaterThan(0)

  await btn(page, 'Go to start').click()
  await expect.poll(() => state(page, 'scrub')).toBe(0)
})

test('next/previous caption jumps the playhead between cues', async ({ page }) => {
  await btn(page, 'Next caption').click()
  const afterNext = await state(page, 'scrub')
  expect(afterNext).toBeGreaterThan(0)

  await btn(page, 'Previous caption').click()
  await expect.poll(() => state(page, 'scrub')).toBeLessThanOrEqual(afterNext)
})

test('click-to-edit the timecode seeks to a typed time', async ({ page }) => {
  await page.getByTestId('current-time').click()
  const input = page.locator('input[inputmode="decimal"]')
  await input.fill('0:05.0')
  await input.press('Enter')
  await expect.poll(() => state(page, 'scrub')).toBeCloseTo(5, 1)
})

test('play advances the playhead and pause stops it', async ({ page }) => {
  await btn(page, 'Play').click()
  await expect.poll(() => state(page, 'scrub'), { timeout: 8000 }).toBeGreaterThan(0)
  await btn(page, 'Pause').click()
  const paused = await state(page, 'scrub')
  await page.waitForTimeout(400)
  expect(await state(page, 'scrub')).toBeCloseTo(paused, 1)
})

test('loop button toggles loop playback', async ({ page }) => {
  expect(await state(page, 'loopPlayback')).toBe(false)
  await page.getByTestId('transport-loop').click()
  await expect.poll(() => state(page, 'loopPlayback')).toBe(true)
  await page.getByTestId('transport-loop').click()
  await expect.poll(() => state(page, 'loopPlayback')).toBe(false)
})

test('the L key toggles loop playback', async ({ page }) => {
  await page.locator('body').click()
  await page.keyboard.press('l')
  await expect.poll(() => state(page, 'loopPlayback')).toBe(true)
  await page.keyboard.press('l')
  await expect.poll(() => state(page, 'loopPlayback')).toBe(false)
})

test('mute button toggles the preview mute', async ({ page }) => {
  expect(await state(page, 'muted')).toBe(false)
  await page.getByTestId('transport-mute').click()
  await expect.poll(() => state(page, 'muted')).toBe(true)
  await page.getByTestId('transport-mute').click()
  await expect.poll(() => state(page, 'muted')).toBe(false)
})

test('the volume popover reveals on hover and shows a readout', async ({ page }) => {
  await expect(page.getByTestId('volume-popover')).toBeHidden()
  await page.getByTestId('transport-mute').hover()
  await expect(page.getByTestId('volume-popover')).toBeVisible()
  await expect(page.getByTestId('volume-readout')).toHaveText('100%')
})

test('the readout shows Muted while muted', async ({ page }) => {
  await page.getByTestId('transport-mute').click()
  await page.getByTestId('transport-mute').hover()
  await expect(page.getByTestId('volume-readout')).toHaveText('Muted')
})

test('moving the volume slider lowers the monitor volume and lifts mute', async ({ page }) => {
  // Start muted, then nudge the slider — it should set a volume and unmute.
  await page.getByTestId('transport-mute').click()
  await expect.poll(() => state(page, 'muted')).toBe(true)

  await page.getByTestId('transport-mute').hover()
  const slider = page.getByTestId('transport-volume').getByRole('slider').first()
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => state(page, 'previewVolume')).toBeGreaterThan(0)
  await expect.poll(() => state(page, 'previewVolume')).toBeLessThan(1)
  await expect.poll(() => state(page, 'muted')).toBe(false)
})

test('scrolling over the control adjusts the volume', async ({ page }) => {
  expect(await state(page, 'previewVolume')).toBe(1)
  await page.getByTestId('transport-mute').hover()
  await page.mouse.wheel(0, 120)
  await expect.poll(() => state(page, 'previewVolume')).toBeLessThan(1)
})
