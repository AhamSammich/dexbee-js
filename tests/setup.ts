import { beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

// Global test setup for jsdom tests
// Note: Blob storage tests are excluded from jsdom and run in real browser instead
beforeEach(() => {
  // Reset IndexedDB state for each test
  const fakeIndexedDB = globalThis.indexedDB as any
  if (fakeIndexedDB._databases) {
    fakeIndexedDB._databases.clear()
  }
})
