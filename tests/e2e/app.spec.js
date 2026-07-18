import { expect, test } from '@playwright/test'

// Smoke + UI flows against the real SPA. Each test starts from a fresh context
// (empty IndexedDB), so the app loads its bundled demo media (audio + image + srt
// + logo) and never shows the restore prompt.

// Wait for boot: splash fades out and the demo has loaded (Export becomes enabled).
async function boot(page) {
  await page.goto('/')
  await expect(page.getByTestId('splash')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByTestId('export-button')).toBeEnabled()
}

test.beforeEach(async ({ page }) => {
  await boot(page)
})

test('boots, loads demo media, and renders the preview', async ({ page }) => {
  await expect(page.getByTestId('preview-canvas')).toBeVisible()
  // Playhead starts at the beginning.
  await expect(page.getByTestId('current-time')).toHaveText('0:00.0')
  // The export control is the ready signal that media decoded successfully.
  await expect(page.getByTestId('export-button')).toBeEnabled()
})

test('inspector tabs switch, and the cue list shows the demo captions', async ({ page }) => {
  // Scope to the inspector — the left Media panel also has Image/Caption tabs.
  const inspector = page.getByTestId('inspector')

  // Style is the default tab; switch to Cues.
  await inspector.getByRole('tab', { name: 'Cues' }).click()
  const list = page.getByTestId('cue-list')
  await expect(list).toBeVisible()

  const rows = page.getByTestId('cue-text')
  await expect(rows.first()).toBeVisible()
  // The demo SRT has several cues.
  expect(await rows.count()).toBeGreaterThan(1)
  // First demo cue is Khmer text.
  await expect(rows.first()).toHaveValue(/ហេតុអ្វី/)

  // Other tabs mount their own panels and become selected.
  await inspector.getByRole('tab', { name: 'Image' }).click()
  await expect(inspector.getByRole('tab', { name: 'Image' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await inspector.getByRole('tab', { name: 'Animation' }).click()
  await expect(inspector.getByRole('tab', { name: 'Animation' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('edits a caption inline in the cue list', async ({ page }) => {
  await page.getByTestId('inspector').getByRole('tab', { name: 'Cues' }).click()
  const first = page.getByTestId('cue-text').first()
  await first.click()
  await first.fill('edited caption text')
  await expect(first).toHaveValue('edited caption text')
})

test('adds a caption through the dialog', async ({ page }) => {
  await page.getByTestId('inspector').getByRole('tab', { name: 'Cues' }).click()
  const before = await page.getByTestId('cue-text').count()

  await page.getByTestId('timeline-add-caption').click()
  const text = page.getByTestId('caption-dialog-text')
  await expect(text).toBeVisible()
  await text.fill('a brand new caption')
  await page.getByTestId('caption-dialog-save').click()

  // Dialog closes and the new cue appears in the list.
  await expect(text).toBeHidden()
  await expect(page.getByTestId('cue-text')).toHaveCount(before + 1)
  // Textarea content lives in .value, not text nodes, so read values directly.
  const values = await page.getByTestId('cue-text').evaluateAll(els => els.map(e => e.value))
  expect(values).toContain('a brand new caption')
})

test('adds a title overlay with the default text', async ({ page }) => {
  const inspector = page.getByTestId('inspector')
  await page.getByTestId('timeline-add-title').click()
  // Titles are edited in the Style tab; the new title shows in its list there.
  await inspector.getByRole('tab', { name: 'Style' }).click()
  await expect(inspector.getByText('ជីវិតខ្ញុំមិនដូចគេ').first()).toBeVisible()
})

test('toggles the UI locale between English and Khmer', async ({ page }) => {
  const exportBtn = page.getByTestId('export-button')
  await expect(exportBtn).toContainText('Export')

  await page.getByTestId('locale-toggle').click()

  // Export label switches to Khmer, and the toggle now offers "EN".
  await expect(exportBtn).toContainText('នាំចេញ')
  await expect(page.getByTestId('locale-toggle')).toContainText('EN')
})

test('toggles between light and dark theme, and the choice survives a reload', async ({
  page,
}) => {
  const html = page.locator('html')
  // Playwright's default color scheme is light, so the app boots light.
  await expect(html).not.toHaveClass(/dark/)

  await page.getByTestId('theme-toggle').click()
  await expect(html).toHaveClass(/dark/)

  // The preference is persisted (localStorage), so it sticks across a reload.
  await boot(page)
  await expect(html).toHaveClass(/dark/)

  await page.getByTestId('theme-toggle').click()
  await expect(html).not.toHaveClass(/dark/)
})

test('plays and advances the playhead, then pauses', async ({ page }) => {
  await expect(page.getByTestId('current-time')).toHaveText('0:00.0')

  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // The timecode should advance away from the start within a moment.
  await expect
    .poll(async () => page.getByTestId('current-time').textContent(), { timeout: 8_000 })
    .not.toBe('0:00.0')

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = await page.getByTestId('current-time').textContent()
  // Give it a beat; the time should not keep climbing once paused.
  await page.waitForTimeout(400)
  await expect(page.getByTestId('current-time')).toHaveText(paused)
})
