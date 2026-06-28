import { expect, test } from '@playwright/test'
import { boot, field, inspectorTab, nudgeSlider, selectOption, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await boot(page)
  await inspectorTab(page, 'Animation')
})

test('selects a caption animation', async ({ page }) => {
  await selectOption(page, page.getByTestId('inspector'), 'Caption animation', 'Typewriter')
  expect(await state(page, 'controls.animation')).toBe('typewriter')
})

test('toggling word highlight shows/hides its options', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  // Highlight is on by default, so its colour control is visible.
  expect(await state(page, 'controls.highlightWord')).toBe(true)
  await expect(field(inspector, 'Highlight colour')).toBeVisible()

  // Toggle off (the switch sits inside its label; click the label text once).
  await inspector.getByText('Karaoke-style active word').click()
  await expect.poll(() => state(page, 'controls.highlightWord')).toBe(false)
  await expect(field(inspector, 'Highlight colour')).toBeHidden()
})

test('changes the ambiance overlay and its intensity', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  // Default is falling leaves; switch to snow.
  await selectOption(page, inspector, 'Overlay effect', 'Snow — gentle')
  expect(await state(page, 'controls.overlay')).toBe('snowGentle')

  const before = await state(page, 'controls.overlayIntensity')
  await nudgeSlider(page, inspector, 'Overlay intensity', 'left', 2)
  expect(await state(page, 'controls.overlayIntensity')).toBeLessThan(before)
})

test('adds a keyframe at the playhead', async ({ page }) => {
  expect(await state(page, 'keyframes.length')).toBe(0)
  await page.getByTestId('timeline-add-keyframe').click()
  expect(await state(page, 'keyframes.length')).toBe(1)
  expect(await state(page, 'hasKeyframes')).toBe(true)
})
