import type { DatabaseSchema } from '../../src/types/schema.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { DatabaseManager } from '../../src/core/database-manager.js'

describe('DatabaseManager Integration Tests', () => {
  const testSchema: DatabaseSchema = {
    version: 1,
    tables: {
      users: {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
          email: { type: 'string', unique: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'email_idx', keyPath: 'email', unique: true },
        ],
      },
    },
  }

  let manager: DatabaseManager

  beforeEach(() => {
    manager = new DatabaseManager('test-db', 1, testSchema)
  })

  it('should connect to database successfully', async () => {
    const db = await manager.connect()

    expect(db).toBeDefined()
    expect(db.name).toBe('test-db')
    expect(db.version).toBe(1)
    expect(manager.isConnected()).toBe(true)

    manager.close()
  })

  it('should create object stores during connection', async () => {
    const db = await manager.connect()

    expect(db.objectStoreNames.contains('users')).toBe(true)

    manager.close()
  })

  it('should handle connection errors gracefully', async () => {
    // Create a manager with invalid configuration to trigger error
    expect(() => {
      // eslint-disable-next-line no-new
      new DatabaseManager('', -1, testSchema)
    }).toThrow('Invalid database name or version')
  })

  it('should return same connection on multiple connect calls', async () => {
    const db1 = await manager.connect()
    const db2 = await manager.connect()

    expect(db1).toBe(db2)
    expect(manager.isConnected()).toBe(true)

    manager.close()
  })

  it('should handle database close properly', async () => {
    await manager.connect()
    expect(manager.isConnected()).toBe(true)

    manager.close()
    expect(manager.isConnected()).toBe(false)
  })
})
