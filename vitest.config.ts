import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Exclude blob storage tests - they require real browser (use pnpm test:integration:browser)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/integration/blob-storage.test.ts',
      '**/tests/integration/blob-simple.test.ts'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '*.config.*'
      ]
    }
  }
});