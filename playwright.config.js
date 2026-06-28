import { defineConfig, devices } from '@playwright/test'

// E2E tests drive the real Nuxt SPA in Chromium (it depends on Canvas, WebCodecs,
// AudioContext and FontFace — all browser-only). The dev server is started
// automatically; each test gets a fresh, isolated browser context (empty
// IndexedDB) so the demo media loads instead of a restore prompt.
const PORT = 3000
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // The app boots a splash, fetches + decodes demo media, then runs an env check;
  // give individual tests room for that first paint.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    // Desktop viewport so App.vue renders DesktopWorkspace (>=1024px).
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
