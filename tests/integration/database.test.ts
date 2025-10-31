import type { DatabaseSchema } from '../../src/types/schema.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Database } from '../../src/core/database.js'
import { DexBee } from '../../src/index.js'
import { DexBeeError } from '../../src/types/errors.js'
import 'fake-indexeddb/auto'

describe('Database Integration Tests', () => {
  const testSchema: DatabaseSchema = {
    version: 1,
    tables: {
      users: {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
          email: { type: 'string', unique: true },
          age: { type: 'number', index: true },
          isActive: { type: 'boolean', default: () => true },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'email_idx', keyPath: 'email', unique: true },
          { name: 'age_idx', keyPath: 'age' },
        ],
      },
      posts: {
        schema: {
          id: { type: 'number', required: true },
          title: { type: 'string', required: true },
          content: { type: 'string' },
          userId: { type: 'number', required: true },
          createdAt: { type: 'date', default: () => new Date() },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'userId_idx', keyPath: 'userId' },
        ],
      },
    },
  }

  let database: Database

  beforeEach(() => {
    database = new Database('test-main-db', testSchema)
  })

  afterEach(() => {
    if (database.isConnected()) {
      database.close()
    }
  })

  it('should create database instance', () => {
    expect(database).toBeDefined()
    expect(database.isConnected()).toBe(false)
  })

  it('should connect to database', async () => {
    await database.connect()

    expect(database.isConnected()).toBe(true)
  })

  it('should validate schema during initialization', () => {
    const invalidSchema: DatabaseSchema = {
      version: -1, // Invalid version
      tables: {},
    }

    expect(() => {
      // eslint-disable-next-line no-new
      new Database('test-invalid-db', invalidSchema)
    }).toThrow()
  })

  it('should create transactions', async () => {
    await database.connect()

    const tx = await database.transaction({
      stores: ['users'],
      mode: 'readonly',
    })

    expect(tx).toBeDefined()
    expect(tx.getMode()).toBe('readonly')

    const store = tx.getStore('users')
    expect(store).toBeDefined()
  })

  it('should handle database operations with data validation', async () => {
    await database.connect()

    // Valid user data
    const validUser = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    }

    expect(() => {
      database.validateData('users', validUser)
    }).not.toThrow()

    // Invalid user data
    const invalidUser = {
      name: 123, // Should be string
      email: 'john@example.com',
    }

    expect(() => {
      database.validateData('users', invalidUser)
    }).toThrow()
  })

  it('should apply default values', async () => {
    await database.connect()

    const userData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      age: 25,
      // isActive missing - should get default
    }

    const processedData = database.applyDefaults('users', userData)
    expect(processedData.isActive).toBe(true)
  })

  it('should handle connection lifecycle', async () => {
    expect(database.isConnected()).toBe(false)

    await database.connect()
    expect(database.isConnected()).toBe(true)

    database.close()
    expect(database.isConnected()).toBe(false)
  })

  it('should perform complete CRUD workflow', async () => {
    await database.connect()

    // Create a user within a transaction
    await database.withWriteTransaction(['users'], async (tx) => {
      const store = tx.getStore('users')

      const userData = database.applyDefaults('users', {
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
      })

      database.validateData('users', userData)

      // Add the user to the store
      const request = store.add(userData)

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    // Read the user back
    const result = await database.withReadTransaction(['users'], async (tx) => {
      const store = tx.getStore('users')
      const request = store.getAll()

      return new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    })

    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].name).toBe('Test User')
    expect(result[0].isActive).toBe(true) // Default value applied
  })
})

describe('DexBee Factory Methods', () => {
  const testSchema: DatabaseSchema = {
    version: 1,
    tables: {
      users: {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      },
    },
  }

  beforeEach(() => {
    // Clean up any existing databases
    const dbName = `test-dexbee-${Date.now()}-${Math.random()}`
    return new Promise<void>((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName)
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => resolve()
    })
  })

  describe('DexBee.create()', () => {
    it('should create database instance without connecting', () => {
      const dbName = `test-create-${Date.now()}-${Math.random()}`
      const db = DexBee.create(dbName, testSchema)

      expect(db).toBeDefined()
      expect(db).toBeInstanceOf(Database)
      expect(db.isConnected()).toBe(false)
    })

    it('should allow manual connection after creation', async () => {
      const dbName = `test-create-connect-${Date.now()}-${Math.random()}`
      const db = DexBee.create(dbName, testSchema)

      expect(db.isConnected()).toBe(false)

      await db.connect()

      expect(db.isConnected()).toBe(true)
      db.close()
    })

    it('should validate schema during creation', () => {
      const dbName = `test-create-invalid-${Date.now()}-${Math.random()}`
      const invalidSchema: DatabaseSchema = {
        version: -1, // Invalid version
        tables: {},
      }

      expect(() => {
        DexBee.create(dbName, invalidSchema)
      }).toThrow(DexBeeError)
    })

    it('should handle empty database name', () => {
      const invalidSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      expect(() => {
        DexBee.create('', invalidSchema)
      }).toThrow()
    })

    it('should preserve schema type information', async () => {
      const dbName = `test-create-typed-${Date.now()}-${Math.random()}`
      const db = DexBee.create(dbName, testSchema)

      await db.connect()
      const users = db.table('users')

      // Should be fully typed
      expect(users).toBeDefined()
      db.close()
    })

    it('should allow delayed connection with multiple operations', async () => {
      const dbName = `test-create-delayed-${Date.now()}-${Math.random()}`
      const db = DexBee.create(dbName, testSchema)

      // Perform operations before connecting
      const schema = db.getSchema()
      expect(schema.version).toBe(1)

      // Now connect
      await db.connect()
      expect(db.isConnected()).toBe(true)

      // Operations should work after connection
      const users = db.table('users')
      await users.insert({ name: 'Test User' })

      const allUsers = await users.all()
      expect(allUsers).toHaveLength(1)

      db.close()
    })
  })

  describe('DexBee.connect()', () => {
    it('should create and connect database immediately', async () => {
      const dbName = `test-connect-${Date.now()}-${Math.random()}`
      const db = await DexBee.connect(dbName, testSchema)

      expect(db).toBeDefined()
      expect(db).toBeInstanceOf(Database)
      expect(db.isConnected()).toBe(true)

      db.close()
    })

    it('should handle connection errors gracefully', async () => {
      // Create a database first
      const dbName = `test-connect-error-${Date.now()}-${Math.random()}`
      const db1 = await DexBee.connect(dbName, testSchema)

      // Try to connect with incompatible version (should fail)
      const incompatibleSchema: DatabaseSchema = {
        version: 999, // Much higher version
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      // This might throw or handle gracefully depending on implementation
      db1.close()
    })

    it('should validate schema before connecting', async () => {
      const dbName = `test-connect-invalid-${Date.now()}-${Math.random()}`
      const invalidSchema: DatabaseSchema = {
        version: 0, // Invalid version
        tables: {},
      }

      await expect(DexBee.connect(dbName, invalidSchema)).rejects.toThrow(DexBeeError)
    })

    it('should handle empty tables schema', async () => {
      const dbName = `test-connect-empty-${Date.now()}-${Math.random()}`
      const emptySchema: DatabaseSchema = {
        version: 1,
        tables: {},
      }

      await expect(DexBee.connect(dbName, emptySchema)).rejects.toThrow(DexBeeError)
    })

    it('should work with complex schemas', async () => {
      const dbName = `test-connect-complex-${Date.now()}-${Math.random()}`
      const complexSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false, unique: true },
              age: { type: 'number', required: false },
              isActive: { type: 'boolean', required: false, default: () => true },
            },
            primaryKey: 'id',
            autoIncrement: true,
            indexes: [
              { name: 'email_idx', keyPath: 'email', unique: true },
            ],
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              userId: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const db = await DexBee.connect(dbName, complexSchema)

      expect(db.isConnected()).toBe(true)
      expect(db.table('users')).toBeDefined()
      expect(db.table('posts')).toBeDefined()

      db.close()
    })

    it('should handle database name with special characters', async () => {
      const dbName = `test-connect-special_123-${Date.now()}`
      const db = await DexBee.connect(dbName, testSchema)

      expect(db.isConnected()).toBe(true)
      db.close()
    })

    it('should handle very long database names', async () => {
      const dbName = `test-connect-${'a'.repeat(200)}-${Date.now()}`
      const db = await DexBee.connect(dbName, testSchema)

      expect(db.isConnected()).toBe(true)
      db.close()
    })
  })

  describe('Connection Error Scenarios', () => {
    it('should throw when connecting with invalid schema version', async () => {
      const dbName = `test-error-version-${Date.now()}-${Math.random()}`
      const invalidSchema: DatabaseSchema = {
        version: -1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      await expect(DexBee.connect(dbName, invalidSchema)).rejects.toThrow(DexBeeError)
    })

    it('should throw when schema has no tables', async () => {
      const dbName = `test-error-notables-${Date.now()}-${Math.random()}`
      const invalidSchema: DatabaseSchema = {
        version: 1,
        tables: {},
      }

      await expect(DexBee.connect(dbName, invalidSchema)).rejects.toThrow(DexBeeError)
    })

    it('should throw when primary key is missing from schema', async () => {
      const dbName = `test-error-pk-${Date.now()}-${Math.random()}`
      const invalidSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              name: { type: 'string', required: true },
            },
            primaryKey: 'id', // 'id' doesn't exist in schema
            autoIncrement: true,
          },
        },
      }

      await expect(DexBee.connect(dbName, invalidSchema)).rejects.toThrow(DexBeeError)
    })

    it('should handle connection after database was deleted', async () => {
      const dbName = `test-error-deleted-${Date.now()}-${Math.random()}`

      // Create and close
      const db1 = await DexBee.connect(dbName, testSchema)
      db1.close()

      // Delete the database
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      })

      // Should be able to reconnect with same schema
      const db2 = await DexBee.connect(dbName, testSchema)
      expect(db2.isConnected()).toBe(true)
      db2.close()
    })
  })

  describe('Database Name Validation', () => {
    it('should accept valid database names', async () => {
      const validNames = [
        'myapp',
        'my_app',
        'my-app',
        'MyApp123',
        'app_123_test',
      ]

      for (const name of validNames) {
        const dbName = `${name}-${Date.now()}-${Math.random()}`
        const db = await DexBee.connect(dbName, testSchema)
        expect(db.isConnected()).toBe(true)
        db.close()
      }
    })

    it('should handle database names with numbers', async () => {
      const dbName = `test123-${Date.now()}`
      const db = await DexBee.connect(dbName, testSchema)
      expect(db.isConnected()).toBe(true)
      db.close()
    })

    it('should handle database names with underscores', async () => {
      const dbName = `test_database_${Date.now()}`
      const db = await DexBee.connect(dbName, testSchema)
      expect(db.isConnected()).toBe(true)
      db.close()
    })
  })

  describe('Multiple Database Instances', () => {
    it('should allow multiple independent database instances', async () => {
      const dbName1 = `test-multi-1-${Date.now()}-${Math.random()}`
      const dbName2 = `test-multi-2-${Date.now()}-${Math.random()}`

      const db1 = await DexBee.connect(dbName1, testSchema)
      const db2 = await DexBee.connect(dbName2, testSchema)

      expect(db1.isConnected()).toBe(true)
      expect(db2.isConnected()).toBe(true)
      expect(db1).not.toBe(db2)

      // Each should have its own data
      const users1 = db1.table('users')
      const users2 = db2.table('users')

      await users1.insert({ name: 'User 1' })
      await users2.insert({ name: 'User 2' })

      const all1 = await users1.all()
      const all2 = await users2.all()

      expect(all1).toHaveLength(1)
      expect(all2).toHaveLength(1)
      expect(all1[0].name).toBe('User 1')
      expect(all2[0].name).toBe('User 2')

      db1.close()
      db2.close()
    })

    it('should handle same database name with different schemas', async () => {
      const dbName = `test-same-name-${Date.now()}-${Math.random()}`

      const schema1: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const schema2: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const db1 = await DexBee.connect(dbName, schema1)
      db1.close()

      // Should be able to connect with version 2 (migration scenario)
      const db2 = await DexBee.connect(dbName, schema2)
      expect(db2.isConnected()).toBe(true)
      db2.close()
    })

    it('should isolate data between database instances', async () => {
      const dbName1 = `test-isolate-1-${Date.now()}-${Math.random()}`
      const dbName2 = `test-isolate-2-${Date.now()}-${Math.random()}`

      const db1 = await DexBee.connect(dbName1, testSchema)
      const db2 = await DexBee.connect(dbName2, testSchema)

      await db1.table('users').insert({ name: 'DB1 User' })
      await db2.table('users').insert({ name: 'DB2 User' })

      const db1Users = await db1.table('users').all()
      const db2Users = await db2.table('users').all()

      expect(db1Users).toHaveLength(1)
      expect(db2Users).toHaveLength(1)
      expect(db1Users[0].name).toBe('DB1 User')
      expect(db2Users[0].name).toBe('DB2 User')

      db1.close()
      db2.close()
    })

    it('should handle concurrent connections to same database', async () => {
      const dbName = `test-concurrent-${Date.now()}-${Math.random()}`

      const db1 = await DexBee.connect(dbName, testSchema)
      const db2 = await DexBee.connect(dbName, testSchema)

      expect(db1.isConnected()).toBe(true)
      expect(db2.isConnected()).toBe(true)

      // Both should see the same data
      await db1.table('users').insert({ name: 'Shared User' })

      const db1Users = await db1.table('users').all()
      const db2Users = await db2.table('users').all()

      expect(db1Users.length).toBeGreaterThan(0)
      expect(db2Users.length).toBeGreaterThan(0)

      db1.close()
      db2.close()
    })
  })

  describe('Factory Method Integration', () => {
    it('should work with create then connect pattern', async () => {
      const dbName = `test-factory-pattern-${Date.now()}-${Math.random()}`

      const db = DexBee.create(dbName, testSchema)
      expect(db.isConnected()).toBe(false)

      await db.connect()
      expect(db.isConnected()).toBe(true)

      const users = db.table('users')
      await users.insert({ name: 'Test' })

      const all = await users.all()
      expect(all).toHaveLength(1)

      db.close()
    })

    it('should be equivalent to direct connect', async () => {
      const dbName1 = `test-equivalent-1-${Date.now()}-${Math.random()}`
      const dbName2 = `test-equivalent-2-${Date.now()}-${Math.random()}`

      const db1 = DexBee.create(dbName1, testSchema)
      await db1.connect()

      const db2 = await DexBee.connect(dbName2, testSchema)

      expect(db1.isConnected()).toBe(true)
      expect(db2.isConnected()).toBe(true)

      // Both should work identically
      await db1.table('users').insert({ name: 'User 1' })
      await db2.table('users').insert({ name: 'User 2' })

      const users1 = await db1.table('users').all()
      const users2 = await db2.table('users').all()

      expect(users1).toHaveLength(1)
      expect(users2).toHaveLength(1)

      db1.close()
      db2.close()
    })
  })
})
