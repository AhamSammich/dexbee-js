import { afterAll, beforeEach } from 'vitest'

// Browser test setup - uses real browser IndexedDB (no fake-indexeddb needed)

// Clean up IndexedDB between tests
beforeEach(async () => {
  // Get all database names
  const databases = await indexedDB.databases()

  // Delete all test databases and wait for completion
  const deletionPromises = []
  for (const db of databases) {
    if (db.name?.startsWith('test-') || db.name?.includes('-test')) {
      const deletePromise = new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(db.name!)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => {
          // Database deletion was blocked, but we'll continue
          resolve()
        }
      })
      deletionPromises.push(deletePromise)
    }
  }
  await Promise.all(deletionPromises)
})

// Global cleanup after all tests
afterAll(async () => {
  const databases = await indexedDB.databases()

  // Delete all test databases and wait for completion
  const deletionPromises = []
  for (const db of databases) {
    if (db.name?.startsWith('test-') || db.name?.includes('-test')) {
      const deletePromise = new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(db.name!)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => {
          // Database deletion was blocked, but we'll continue
          resolve()
        }
      })
      deletionPromises.push(deletePromise)
    }
  }
  await Promise.all(deletionPromises)
})
