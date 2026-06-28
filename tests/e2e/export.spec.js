import { expect, test } from '@playwright/test'
import { boot, state } from './helpers'

// Exercises the real encode pipeline end to end. The fast WebCodecs path loads
// mediabunny from a CDN at runtime; give it generous time. The variable-length
// segment encoder keeps a mostly-static demo fast despite its duration.
test.describe('export pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await boot(page)
  })

  test('renders the demo to a downloadable video', async ({ page }) => {
    test.setTimeout(120_000)

    await page.getByTestId('export-button').click()

    // Result overlay appears with a playable video once encoding finishes.
    await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 100_000 })
    const video = page.getByTestId('result-video')
    await expect(video).toBeVisible()

    // The produced blob is non-trivial in size.
    const sizeMB = await state(page, 'result.sizeMB')
    expect(Number(sizeMB)).toBeGreaterThan(0)

    // A download link is offered with a sensible extension.
    const ext = await state(page, 'result.ext')
    expect(['mp4', 'webm']).toContain(ext)
    await expect(page.getByTestId('result-download')).toHaveAttribute('download', /\.(mp4|webm)$/)
  })
})
