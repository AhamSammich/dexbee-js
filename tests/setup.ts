import 'fake-indexeddb/auto';

// Global test setup
beforeEach(() => {
  // Reset IndexedDB state for each test
  const fakeIndexedDB = globalThis.indexedDB as any;
  if (fakeIndexedDB._databases) {
    fakeIndexedDB._databases.clear();
  }
});