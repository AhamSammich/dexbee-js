import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
      // Disable screenshots - not useful for library testing without UI
      screenshotFailures: false,
    },
    // Use a separate setup file for browser tests (no fake-indexeddb needed)
    setupFiles: ['./tests/browser-setup.ts'],
    // Only run blob storage tests in browser mode
    include: ['tests/integration/blob-storage.test.ts'],
  },
});
