import { expect, test } from '@playwright/test'
import { boot, field, inspectorTab, nudgeSlider, selectOption, state } from './helpers'

// Caption style controls live in the inspector "Style" tab (default).
test.beforeEach(async ({ page }) => {
  await boot(page)
  await inspectorTab(page, 'Style')
})

test('applying a preset updates the caption controls', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  await selectOption(page, inspector, 'Preset', 'Yellow Pop')
  expect(await state(page, 'controls.fill')).toBe('#ffe14d')
  expect(await state(page, 'controls.fontWeight')).toBe('700')
})

test('changing the caption position writes to the store', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  await selectOption(page, inspector, 'Position', 'Top')
  expect(await state(page, 'controls.position')).toBe('top')
})

test('font size slider changes the size and flips the preset to custom', async ({ page }) => {
  const before = await state(page, 'controls.fontSizePct')
  await nudgeSlider(page, page.getByTestId('inspector'), 'Font size', 'right', 3)
  const after = await state(page, 'controls.fontSizePct')
  expect(after).toBeGreaterThan(before)
  expect(await state(page, 'preset')).toBe('custom')
})

test('the text colour picker updates the fill', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  const color = field(inspector, 'Text colour').locator('input[type="color"]')
  await color.fill('#123456')
  expect(await state(page, 'controls.fill')).toBe('#123456')
})

test('toggling the background box updates the control', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  const before = await state(page, 'controls.box')
  await field(inspector, 'Background').getByRole('checkbox').click()
  expect(await state(page, 'controls.box')).toBe(!before)
})
