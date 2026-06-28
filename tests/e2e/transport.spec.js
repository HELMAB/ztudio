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
