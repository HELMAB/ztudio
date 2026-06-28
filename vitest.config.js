import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests target the pure logic in app/lib/ztudio/* — plain ES modules with no
// browser dependencies — so the default Node environment is enough. The '@' alias
// mirrors Nuxt's so tests can import via either '@/lib/...' or relative paths.
export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only; E2E specs under tests/e2e are run by Playwright.
    include: ['tests/unit/**/*.test.js'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
