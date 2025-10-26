import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from '../../src/core/database.js'
import type { DatabaseSchema } from '../../src/types/schema.js'

describe('Operation Queue Integration Tests', () => {
  const testSchema: DatabaseSchema = {
    version: 1,
    tables: {
      users: {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
          count: { type: 'number', default: () => 0 },
        },
        primaryKey: 'id',
        autoIncrement: true,
      },
    },
  }

  let database: Database

  beforeEach(async () => {
    database = new Database('test-queue-db', testSchema)
    await database.connect()
  })

  afterEach(() => {
    if (database.isConnected()) {
      database.close()
    }
  })

  it('should prevent race conditions on concurrent updates', async () => {
    const table = database.table('users')

    // Insert initial record
    const user = await table.insert({ name: 'Test User', count: 0 })
    const userId = user.id

    // Simulate rapid concurrent updates (the race condition scenario)
    // Without queuing, these would read-then-write and cause lost updates
    await Promise.all([
      table.update(userId, { count: 1 }),
      table.update(userId, { count: 2 }),
      table.update(userId, { count: 3 }),
      table.update(userId, { count: 4 }),
      table.update(userId, { count: 5 }),
    ])

    // With queuing, the final count should be the last update
    const final = await table.findById(userId)

    expect(final).toBeDefined()
    expect(final!.count).toBe(5)
  })

  it('should allow parallel updates to different records', async () => {
    const table = database.table('users')

    const user1 = await table.insert({ name: 'User 1', count: 0 })
    const user2 = await table.insert({ name: 'User 2', count: 0 })
    const user3 = await table.insert({ name: 'User 3', count: 0 })

    const startTime = Date.now()

    // These should run in parallel (different IDs)
    await Promise.all([
      table.update(user1.id, { count: 1 }),
      table.update(user2.id, { count: 1 }),
      table.update(user3.id, { count: 1 }),
    ])

    const duration = Date.now() - startTime

    // Should complete quickly (parallel execution)
    // This is a loose check - just ensuring it's not sequential
    expect(duration).toBeLessThan(1000)

    // All records should be updated
    const [final1, final2, final3] = await Promise.all([
      table.findById(user1.id),
      table.findById(user2.id),
      table.findById(user3.id),
    ])

    expect(final1!.count).toBe(1)
    expect(final2!.count).toBe(1)
    expect(final3!.count).toBe(1)
  })

  it('should handle errors without breaking the queue', async () => {
    const table = database.table('users')

    const user = await table.insert({ name: 'Test User' })

    // Queue multiple operations, with one failing in the middle
    const results = await Promise.allSettled([
      table.update(user.id, { count: 1 }),
      table.update(999999, { count: 2 }), // This will fail - ID doesn't exist
      table.update(user.id, { count: 3 }),
    ])

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected') // Failed update
    expect(results[2].status).toBe('fulfilled') // Should still execute

    const final = await table.findById(user.id)
    expect(final!.count).toBe(3) // Last successful update
  })

  it('should allow disabling the queue', async () => {
    const table = database.table('users', { queueOperations: false })

    const user = await table.insert({ name: 'Test User', count: 0 })

    // Without queuing, these execute immediately
    // (this test just verifies the option works, not testing race conditions)
    await Promise.all([
      table.update(user.id, { count: 1 }),
      table.update(user.id, { count: 2 }),
    ])

    const stats = table.getQueueStats()
    expect(stats.enabled).toBe(false)
  })

  it('should provide queue statistics', async () => {
    const table = database.table('users')

    const user = await table.insert({ name: 'Test User' })

    const stats = table.getQueueStats()
    expect(stats).toEqual({
      pendingOperations: 0,
      enabled: true,
    })

    // Queue an operation and check stats
    const updatePromise = table.update(user.id, { count: 1 })

    // Wait for completion
    await updatePromise

    const finalStats = table.getQueueStats()
    expect(finalStats.pendingOperations).toBe(0) // Should be cleaned up
    expect(finalStats.enabled).toBe(true)
  })

  it('should handle sequential delete operations', async () => {
    const table = database.table('users')

    const user = await table.insert({ name: 'Test User' })

    // Queue multiple operations including delete
    await table.update(user.id, { count: 1 })
    await table.update(user.id, { count: 2 })
    await table.delete(user.id)

    const final = await table.findById(user.id)
    expect(final).toBeNull() // Should be deleted
  })

  it('should queue operations by record ID correctly', async () => {
    const table = database.table('users')

    const user1 = await table.insert({ name: 'User 1', count: 0 })
    const user2 = await table.insert({ name: 'User 2', count: 0 })

    // Mix of operations on two different users
    await Promise.all([
      table.update(user1.id, { count: 1 }),
      table.update(user2.id, { count: 10 }),
      table.update(user1.id, { count: 2 }),
      table.update(user2.id, { count: 20 }),
      table.update(user1.id, { count: 3 }),
      table.update(user2.id, { count: 30 }),
    ])

    const [final1, final2] = await Promise.all([
      table.findById(user1.id),
      table.findById(user2.id),
    ])

    // Each user should have their last update value
    expect(final1!.count).toBe(3)
    expect(final2!.count).toBe(30)
  })
})
