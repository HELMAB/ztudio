import { expect, test } from '@playwright/test'
import { boot, inspectorTab, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
})

test('undo and redo a title addition', async ({ page }) => {
  // The demo seeds one title; work with deltas off the current count.
  const before = await state(page, 'texts.length')

  await page.getByTestId('timeline-add-title').click()
  await expect.poll(() => state(page, 'texts.length')).toBe(before + 1)

  // History coalesces edits (~400ms); wait until undo is available.
  await expect.poll(() => state(page, 'canUndo'), { timeout: 4000 }).toBe(true)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => state(page, 'texts.length')).toBe(before)

  await page.getByRole('button', { name: 'Redo' }).click()
  await expect.poll(() => state(page, 'texts.length')).toBe(before + 1)
})

test('the keyboard shortcuts overlay opens with "?" and closes', async ({ page }) => {
  await page.keyboard.press('?')
  await expect(page.getByText('Keyboard shortcuts')).toBeVisible()
  await expect.poll(() => state(page, 'showShortcuts')).toBe(true)

  await page.keyboard.press('Escape')
  await expect.poll(() => state(page, 'showShortcuts')).toBe(false)
})

test('cue list edits go onto the undo stack', async ({ page }) => {
  await inspectorTab(page, 'Cues')
  const first = page.getByTestId('cue-text').first()
  const original = await first.inputValue()
  await first.fill('history edit test')
  await expect.poll(() => state(page, 'canUndo'), { timeout: 4000 }).toBe(true)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(first).toHaveValue(original)
})
