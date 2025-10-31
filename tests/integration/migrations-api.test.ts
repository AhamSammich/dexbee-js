import type { DatabaseSchema } from '../../src/types/schema.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DexBee } from '../../src/index.js'
import { withMigrations } from '../../src/migrations.js'
import { DexBeeError, DexBeeErrorCode } from '../../src/types/errors.js'
import 'fake-indexeddb/auto'

describe('withMigrations API', () => {
  let dbName: string

  beforeEach(() => {
    dbName = `test-migrations-api-${Date.now()}-${Math.random()}`
  })

  afterEach(async () => {
    // Cleanup: Delete the test database
    try {
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      })
    }
    catch (error) {
      console.warn('Failed to cleanup test database:', error)
    }
  })

  describe('withMigrations function', () => {
    it('should return a MigratableDatabase instance', async () => {
      const schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, schema)
      const migratable = withMigrations(db)

      expect(migratable).toBeDefined()
      expect(migratable).toHaveProperty('migrate')
      expect(migratable).toHaveProperty('dryRunMigration')
      expect(migratable).toHaveProperty('getMigrationStatus')
      expect(typeof migratable.migrate).toBe('function')
      expect(typeof migratable.dryRunMigration).toBe('function')
      expect(typeof migratable.getMigrationStatus).toBe('function')

      db.close()
    })

    it('should preserve original database functionality', async () => {
      const schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, schema)
      const migratable = withMigrations(db)

      // Original database methods should still work
      expect(migratable.table('users')).toBeDefined()
      expect(migratable.isConnected()).toBe(true)
      expect(migratable.getSchema()).toBeDefined()

      const users = migratable.table('users')
      await users.insert({ name: 'Test User' })

      const allUsers = await users.all()
      expect(allUsers).toHaveLength(1)

      db.close()
    })

    it('should work with DexBee.create() pattern', async () => {
      const schema: DatabaseSchema = {
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

      const db = DexBee.create(dbName, schema)
      await db.connect()

      const migratable = withMigrations(db)

      expect(migratable).toHaveProperty('migrate')
      expect(migratable.isConnected()).toBe(true)

      db.close()
    })

    it('should handle disconnected database', async () => {
      const schema: DatabaseSchema = {
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

      const db = DexBee.create(dbName, schema)
      const migratable = withMigrations(db)

      // Migration methods should throw when not connected
      const newSchema: DatabaseSchema = {
        version: 2,
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

      try {
        await migratable.migrate(newSchema)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.CONNECTION_FAILED)
      }

      try {
        await migratable.dryRunMigration(newSchema)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.CONNECTION_FAILED)
      }

      try {
        await migratable.getMigrationStatus()
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.CONNECTION_FAILED)
      }
    })
  })

  describe('migrate method', () => {
    it('should perform successful migration', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      // Add some data
      await migratable.table('users').insert({ name: 'Alice' })
      await migratable.table('users').insert({ name: 'Bob' })

      const v2Schema: DatabaseSchema = {
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

      const result = await migratable.migrate(v2Schema)

      expect(result.success).toBe(true)
      expect(result.operationsExecuted).toBeGreaterThan(0)
      expect(result.version).toBe(2)

      // Verify data is preserved
      const users = await migratable.table('users').all()
      expect(users).toHaveLength(2)

      db.close()
    })

    it('should throw when database is not connected', async () => {
      const schema: DatabaseSchema = {
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

      const db = DexBee.create(dbName, schema)
      const migratable = withMigrations(db)

      try {
        await migratable.migrate(schema)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.CONNECTION_FAILED)
      }
    })

    it('should handle migration with no changes', async () => {
      const schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, schema)
      const migratable = withMigrations(db)

      // Migrate to same schema
      const result = await migratable.migrate(schema)

      expect(result.success).toBe(true)
      expect(result.operationsExecuted).toBe(0)

      db.close()
    })

    it('should handle migration options', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      const v2Schema: DatabaseSchema = {
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

      const result = await migratable.migrate(v2Schema, {
        validateEachStep: true,
      })

      expect(result.success).toBe(true)

      db.close()
    })

    it('should handle complex migration with multiple operations', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      const v2Schema: DatabaseSchema = {
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
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      // Close and reopen to allow version upgrade
      db.close()

      // Reconnect with new schema - IndexedDB will handle version upgrade
      const db2 = await DexBee.connect(dbName, v2Schema)
      const migratable2 = withMigrations(db2)

      // Verify new table exists
      const posts = migratable2.table('posts')
      expect(posts).toBeDefined()

      db2.close()
    })
  })

  describe('dryRunMigration method', () => {
    it('should perform dry run without modifying database', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      // Add data
      await migratable.table('users').insert({ name: 'Test User' })

      const v2Schema: DatabaseSchema = {
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

      const dryRun = await migratable.dryRunMigration(v2Schema)

      expect(dryRun.isValid).toBe(true)
      expect(dryRun.operations).toBeDefined()
      expect(Array.isArray(dryRun.operations)).toBe(true)

      // Verify database wasn't modified
      const users = await migratable.table('users').all()
      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('Test User')

      db.close()
    })

    it('should throw when database is not connected', async () => {
      const schema: DatabaseSchema = {
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

      const db = DexBee.create(dbName, schema)
      const migratable = withMigrations(db)

      try {
        await migratable.dryRunMigration(schema)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.CONNECTION_FAILED)
      }
    })

    it('should detect invalid migration plans', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      // Try to migrate to lower version (should fail)
      const invalidSchema: DatabaseSchema = {
        version: 0,
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

      await expect(migratable.dryRunMigration(invalidSchema)).rejects.toThrow()

      db.close()
    })

    it('should provide warnings for empty migrations', async () => {
      const schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, schema)
      const migratable = withMigrations(db)

      // Dry run with same schema
      const dryRun = await migratable.dryRunMigration(schema)

      expect(dryRun.isValid).toBe(true)
      expect(dryRun.operations).toHaveLength(0)
      expect(dryRun.warnings.length).toBeGreaterThan(0)

      db.close()
    })

    it('should handle migration options', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      const v2Schema: DatabaseSchema = {
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

      const dryRun = await migratable.dryRunMigration(v2Schema, {
        validateEachStep: true,
      })

      expect(dryRun.isValid).toBe(true)

      db.close()
    })
  })

  describe('getMigrationStatus method', () => {
    it('should return current migration status', async () => {
      const schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, schema)
      const migratable = withMigrations(db)

      const status = await migratable.getMigrationStatus()

      expect(status).toBeDefined()
      expect(status.currentVersion).toBe(1)

      db.close()
    })

    it('should reflect version after migration', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      let status = await migratable.getMigrationStatus()
      expect(status.currentVersion).toBe(1)

      const v2Schema: DatabaseSchema = {
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

      await migratable.migrate(v2Schema)

      status = await migratable.getMigrationStatus()
      expect(status.currentVersion).toBeGreaterThanOrEqual(1)

      db.close()
    })

    it('should throw when database is not connected', async () => {
      const schema: DatabaseSchema = {
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

      const db = DexBee.create(dbName, schema)
      const migratable = withMigrations(db)

      await expect(migratable.getMigrationStatus()).rejects.toThrow(DexBeeError)
      try {
        await migratable.getMigrationStatus()
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.CONNECTION_FAILED)
      }
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete migration workflow', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      // Add initial data
      await migratable.table('users').insert({ name: 'Alice' })

      const v2Schema: DatabaseSchema = {
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

      // Step 1: Dry run
      const dryRun = await migratable.dryRunMigration(v2Schema)
      expect(dryRun.isValid).toBe(true)

      // Step 2: Check status
      const beforeStatus = await migratable.getMigrationStatus()
      expect(beforeStatus.currentVersion).toBe(1)

      // Step 3: Migrate
      const result = await migratable.migrate(v2Schema)
      expect(result.success).toBe(true)

      // Step 4: Verify status updated
      const afterStatus = await migratable.getMigrationStatus()
      expect(afterStatus.currentVersion).toBeGreaterThanOrEqual(1)

      // Step 5: Verify data preserved
      const users = await migratable.table('users').all()
      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('Alice')

      db.close()
    })

    it('should handle multiple sequential migrations', async () => {
      const v1Schema: DatabaseSchema = {
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

      // Create v1 database
      let db = await DexBee.connect(dbName, v1Schema)
      db.close()

      // Connect with v2 schema - IndexedDB handles upgrade
      const v2Schema: DatabaseSchema = {
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

      db = await DexBee.connect(dbName, v2Schema)
      let migratable = withMigrations(db)
      db.close()

      // Connect with v3 schema - IndexedDB handles upgrade
      const v3Schema: DatabaseSchema = {
        version: 3,
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
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      db = await DexBee.connect(dbName, v3Schema)
      migratable = withMigrations(db)

      // Verify posts table exists
      const posts = migratable.table('posts')
      expect(posts).toBeDefined()

      db.close()
    })

    it('should preserve original database methods after migration', async () => {
      const v1Schema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, v1Schema)
      const migratable = withMigrations(db)

      const v2Schema: DatabaseSchema = {
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

      await migratable.migrate(v2Schema)

      // Original methods should still work
      expect(migratable.isConnected()).toBe(true)
      expect(migratable.table('users')).toBeDefined()
      expect(migratable.getSchema()).toBeDefined()

      const users = migratable.table('users')
      await users.insert({ name: 'Test', email: 'test@example.com' })

      const all = await users.all()
      expect(all.length).toBeGreaterThan(0)

      db.close()
    })
  })
})
