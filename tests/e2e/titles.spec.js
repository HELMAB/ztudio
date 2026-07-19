import { expect, test } from '@playwright/test'
import { boot, field, inspectorTab, nudgeSlider, selectOption, state } from './helpers'

// Titles are managed in the Style tab (the Titles tab was merged in). The demo
// seeds one default title, so tests work with deltas and the selected title.
test.beforeEach(async ({ page }) => {
  await boot(page)
  await inspectorTab(page, 'Style')
})

// The title-controls section (scoped so its labels don't clash with the caption
// style controls that share the same tab).
const titles = page => page.getByTestId('title-controls')

// Add a fresh title (which becomes the selected one) and return the prior count.
async function addTitle(page) {
  const before = await state(page, 'texts.length')
  await page.getByTestId('timeline-add-title').click()
  await expect.poll(() => state(page, 'texts.length')).toBe(before + 1)
  return before
}

test('adds a title with the default text', async ({ page }) => {
  await addTitle(page)
  await expect(titles(page).getByText('ជីវិតខ្ញុំមិនដូចគេ').first()).toBeVisible()
  expect(await state(page, 'selectedText.text')).toBe('ជីវិតខ្ញុំមិនដូចគេ')
})

test('edits the selected title text', async ({ page }) => {
  await addTitle(page)
  await field(titles(page), 'Text').locator('textarea').fill('Custom title')
  await expect.poll(() => state(page, 'selectedText.text')).toBe('Custom title')
})

test('sets a title anchor preset', async ({ page }) => {
  await addTitle(page)
  await selectOption(page, titles(page), 'Anchor', 'Center')
  await expect.poll(() => state(page, 'selectedText.y')).toBe(0.5)
})

test('toggles the title bold weight', async ({ page }) => {
  await addTitle(page)
  const before = await state(page, 'selectedText.bold')
  await titles(page).getByText('Bold weight').click()
  await expect.poll(() => state(page, 'selectedText.bold')).toBe(!before)
})

test('changes the title colour', async ({ page }) => {
  await addTitle(page)
  await field(titles(page), 'Text colour').locator('input[type="color"]').fill('#ff0000')
  await expect.poll(() => state(page, 'selectedText.color')).toBe('#ff0000')
})

test('rotates the selected title via the slider', async ({ page }) => {
  await addTitle(page)
  expect(await state(page, 'selectedText.rotation')).toBe(0)
  await nudgeSlider(page, titles(page), 'Rotation', 'right', 4)
  await expect.poll(() => state(page, 'selectedText.rotation')).toBe(4)
})

test('deletes a title', async ({ page }) => {
  const before = await addTitle(page)
  await titles(page).getByRole('button', { name: 'Delete title' }).last().click()
  await expect.poll(() => state(page, 'texts.length')).toBe(before)
})
