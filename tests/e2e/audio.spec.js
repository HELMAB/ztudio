import { expect, test } from '@playwright/test'
import { boot, DEMO, field, nudgeSlider, state } from './helpers'

// Audio mix controls live in the right inspector's "Audio" tab.
test.beforeEach(async ({ page }) => {
  await boot(page)
  await page.getByTestId('inspector').getByRole('tab', { name: 'Audio', exact: true }).click()
})

const audioPanel = page => page.getByTestId('inspector')

test('adjusts the voice volume', async ({ page }) => {
  const before = await state(page, 'audio.voiceGain')
  await nudgeSlider(page, audioPanel(page), 'Voice volume', 'left', 3)
  await expect.poll(() => state(page, 'audio.voiceGain')).toBeLessThan(before)
})

test('uploads a music bed and controls it (volume, loop, ducking)', async ({ page }) => {
  const panel = audioPanel(page)
  // The music-bed uploader is the only file input in this tab now (the voice
  // track is imported via the Assets tab).
  await panel.locator('input[type="file"]').setInputFiles(DEMO.audio)
  await expect.poll(() => state(page, 'hasMusic')).toBe(true)

  // Music-only controls appear once a bed is loaded.
  await expect(field(panel, 'Music volume')).toBeVisible()

  // Loop defaults on; toggle it off via its inner switch label.
  await panel.getByText('Repeat to fill the video').click()
  await expect.poll(() => state(page, 'audio.musicLoop')).toBe(false)

  // Ducking defaults on; toggle it off.
  expect(await state(page, 'audio.ducking')).toBe(true)
  await panel.getByText('Lower music under the voice').click()
  await expect.poll(() => state(page, 'audio.ducking')).toBe(false)
})
