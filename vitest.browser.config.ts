/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      // Disable screenshots - not useful for library testing without UI
      screenshotFailures: false,
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
    // Use a separate setup file for browser tests (no fake-indexeddb needed)
    setupFiles: ['./tests/browser-setup.ts'],
    // Only run blob storage tests in browser mode
    include: ['tests/integration/blob-storage.test.ts'],
  },
})
