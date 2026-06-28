import { expect, test } from '@playwright/test'
import { boot, DEMO, field, nudgeSlider, state } from './helpers'

// Audio controls live in the left Media panel's "Audio" tab (default tab there).
test.beforeEach(async ({ page }) => {
  await boot(page)
})

const mediaPanel = page => page.locator('aside').filter({ hasText: 'Voice volume' })

test('adjusts the voice volume', async ({ page }) => {
  const before = await state(page, 'audio.voiceGain')
  await nudgeSlider(page, mediaPanel(page), 'Voice volume', 'left', 3)
  await expect.poll(() => state(page, 'audio.voiceGain')).toBeLessThan(before)
})

test('uploads a music bed and controls it (volume, loop, ducking)', async ({ page }) => {
  const panel = mediaPanel(page)
  // Two audio file inputs exist in this tab (voice, then music) — music is 2nd.
  await panel.locator('input[type="file"]').nth(1).setInputFiles(DEMO.audio)
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
