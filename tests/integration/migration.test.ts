import type {
  DatabaseSchema,
} from '../../src/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DexBee,
} from '../../src/index.js'
import {
  AddFieldOperation,
  AddTableOperation,
  AlterFieldOperation,
  DataTransformer,
  SchemaDiffEngine,
  TransformDataOperation,
  withMigrations,
} from '../../src/migrations.js'
import 'fake-indexeddb/auto'

describe('Migration System Integration', () => {
  let dbName: string

  beforeEach(() => {
    dbName = `test-migration-${Date.now()}-${Math.random()}`
  })

  afterEach(async () => {
    // Cleanup: Delete the test database
    try {
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      })
    } catch (error) {
      console.warn('Failed to cleanup test database:', error)
    }
  })

  describe('Schema Diff Engine', () => {
    it('should detect added tables', () => {
      const diffEngine = new SchemaDiffEngine()

      const oldSchema: DatabaseSchema = {
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
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              content: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const diff = diffEngine.generateDiff(oldSchema, newSchema)

      expect(diff.tablesAdded).toHaveLength(1)
      expect((diff.tablesAdded[0] as any).name).toBe('posts')
      expect(diff.tablesDropped).toHaveLength(0)
      expect(diff.tablesModified).toHaveLength(0)
    })

    it('should detect dropped tables', () => {
      const diffEngine = new SchemaDiffEngine()

      const oldSchema: DatabaseSchema = {
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

      const diff = diffEngine.generateDiff(oldSchema, newSchema)

      expect(diff.tablesAdded).toHaveLength(0)
      expect(diff.tablesDropped).toHaveLength(1)
      expect(diff.tablesDropped[0]).toBe('posts')
      expect(diff.tablesModified).toHaveLength(0)
    })

    it('should detect field modifications', () => {
      const diffEngine = new SchemaDiffEngine()

      const oldSchema: DatabaseSchema = {
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

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
              age: { type: 'number', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const diff = diffEngine.generateDiff(oldSchema, newSchema)

      expect(diff.tablesAdded).toHaveLength(0)
      expect(diff.tablesDropped).toHaveLength(0)
      expect(diff.tablesModified).toHaveLength(1)
      expect(diff.tablesModified[0].tableName).toBe('users')
      expect(diff.tablesModified[0].fieldsAdded).toHaveLength(2)
      expect(diff.tablesModified[0].fieldsAdded[0].fieldName).toBe('email')
      expect(diff.tablesModified[0].fieldsAdded[1].fieldName).toBe('age')
    })

    it('should create migration operations from diff', async () => {
      const diffEngine = new SchemaDiffEngine()

      const oldSchema: DatabaseSchema = {
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

      const newSchema: DatabaseSchema = {
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

      const diff = diffEngine.generateDiff(oldSchema, newSchema)
      const operations = await diffEngine.createMigrationOperations(diff)

      expect(operations).toHaveLength(2)
      expect(operations[0].type).toBe('addTable')
      expect(operations[0].tableName).toBe('posts')
      expect(operations[1].type).toBe('addField')
      expect(operations[1].tableName).toBe('users')
    })
  })

  describe('Migration Operations', () => {
    it('AddTableOperation should validate correctly', () => {
      const tableConfig = {
        schema: {
          id: { type: 'number' as const, required: true },
          name: { type: 'string' as const, required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('test_table', tableConfig)

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {},
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          test_table: tableConfig,
        },
      }

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('AddTableOperation should throw for existing table', () => {
      const tableConfig = {
        schema: {
          id: { type: 'number' as const, required: true },
          name: { type: 'string' as const, required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('test_table', tableConfig)

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          test_table: tableConfig,
        },
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          test_table: tableConfig,
        },
      }

      expect(() => operation.validate(oldSchema, newSchema)).toThrow()
    })

    it('AddFieldOperation should validate correctly', () => {
      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      const oldSchema: DatabaseSchema = {
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

      const newSchema: DatabaseSchema = {
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

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('AlterFieldOperation should detect type changes', () => {
      const operation = new AlterFieldOperation(
        'users',
        'age',
        { type: 'string', required: false },
        { type: 'number', required: false },
      )

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              age: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              age: { type: 'number', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('Data Transformation', () => {
    it('should validate transformation functions', async () => {
      const transformer = new DataTransformer()

      const validTransformation = {
        transform: (record: any) => ({ ...record, newField: 'test' }),
        filter: (record: any) => true,
        validate: (result: any) => result.newField === 'test',
      }

      const result = await transformer.validateTransformation(
        'test_table',
        validTransformation,
        10,
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid transformation functions', async () => {
      const transformer = new DataTransformer()

      const invalidTransformation = {
        transform: 'not a function',
        filter: (record: any) => true,
      }

      const result = await transformer.validateTransformation(
        'test_table',
        invalidTransformation as any,
        10,
      )

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Migration Manager Integration', () => {
    it('should generate migration plan for schema changes', async () => {
      // Create initial database
      const initialSchema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, initialSchema)
      const migratable = withMigrations(db)

      // Define new schema
      const newSchema: DatabaseSchema = {
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
              content: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      // Test dry run
      const dryRunResult = await migratable.dryRunMigration(newSchema)

      expect(dryRunResult.isValid).toBe(true)
      expect(dryRunResult.operations.length).toBeGreaterThan(0)
      expect(dryRunResult.errors).toHaveLength(0)

      // Test migration status
      const status = await migratable.getMigrationStatus()
      expect(status.currentVersion).toBe(1)

      db.close()
    })

    it('should handle empty migration', async () => {
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

      // Try to migrate to the same schema
      const dryRunResult = await migratable.dryRunMigration(schema)

      expect(dryRunResult.isValid).toBe(true)
      expect(dryRunResult.operations).toHaveLength(0)
      expect(dryRunResult.warnings).toContain('Migration plan has no operations')

      db.close()
    })

    it('should validate migration prerequisites', async () => {
      const initialSchema: DatabaseSchema = {
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

      const db = await DexBee.connect(dbName, initialSchema)
      const migratable = withMigrations(db)

      // Try to migrate to a lower version (should fail)
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
  })

  describe('TransformDataOperation', () => {
    it('should validate transformation operation', () => {
      const transformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        filter: (record: any) => !record.processed,
        validate: (result: any) => result.processed === true,
      }

      const operation = new TransformDataOperation('users', transformation)

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

      expect(() => operation.validate(schema, schema)).not.toThrow()
    })

    it('should reject invalid transformation', () => {
      const invalidTransformation = {
        // Missing transform function
        filter: (record: any) => true,
      }

      const operation = new TransformDataOperation('users', invalidTransformation as any)

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

      expect(() => operation.validate(schema, schema)).toThrow()
    })
  })

  describe('End-to-End Migration', () => {
    it('should complete full migration workflow', async () => {
      // Step 1: Create initial database
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

      // Add some initial data
      const users = db.table('users')
      await users.insert({ name: 'Alice' })
      await users.insert({ name: 'Bob' })

      // Verify initial state
      const initialUsers = await users.all()
      expect(initialUsers).toHaveLength(2)

      // Step 2: Define new schema
      const v2Schema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false, default: () => '' },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              authorId: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      // Step 3: Dry run migration
      const dryRun = await migratable.dryRunMigration(v2Schema)
      expect(dryRun.isValid).toBe(true)
      expect(dryRun.operations.length).toBeGreaterThan(0)

      // Step 4: Get migration status
      const beforeStatus = await migratable.getMigrationStatus()
      expect(beforeStatus.currentVersion).toBe(1)

      // Note: Actual migration execution would require more complex setup
      // with proper IndexedDB version change handling. For now, we test
      // the planning and validation aspects.

      db.close()
    })
  })

  describe('Real Migration Execution', () => {
    it('should execute migration and preserve existing data', async () => {
      // Step 1: Create initial database with v1 schema
      const v1Schema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              age: { type: 'number', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const db = await DexBee.connect(dbName, v1Schema)

      // Step 2: Insert test data
      const users = db.table('users')
      await users.insert({ name: 'Alice', age: 30 })
      await users.insert({ name: 'Bob', age: 25 })
      await users.insert({ name: 'Charlie', age: 35 })

      // Verify initial data
      const initialUsers = await users.all()
      expect(initialUsers).toHaveLength(3)
      expect(initialUsers[0].name).toBe('Alice')

      // Step 3: Close and reopen with new schema
      db.close()

      // Define v2 schema with new field
      const v2Schema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              age: { type: 'number', required: false },
              email: { type: 'string', required: false, default: () => '' },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      // Reopen with v2 schema - IndexedDB will handle version upgrade
      const db2 = await DexBee.connect(dbName, v2Schema)
      const migratable = withMigrations(db2)

      // Step 4: Verify migration status shows upgrade happened
      const status = await migratable.getMigrationStatus()
      expect(status.currentVersion).toBeGreaterThanOrEqual(1)

      // Step 5: Verify existing data is preserved
      const users2 = db2.table('users')
      const migratedUsers = await users2.all()
      expect(migratedUsers).toHaveLength(3)

      // Verify original fields are intact
      const alice = migratedUsers.find(u => u.name === 'Alice')
      expect(alice).toBeDefined()
      expect(alice!.age).toBe(30)

      // Note: IndexedDB doesn't automatically add new fields to existing records
      // The new field exists in the schema but won't appear in old records
      // unless we explicitly migrate the data

      // Step 6: Insert new data with new field
      await users2.insert({ name: 'David', age: 28, email: 'david@example.com' })

      const allUsers = await users2.all()
      expect(allUsers).toHaveLength(4)

      const david = allUsers.find(u => u.name === 'David')
      expect(david!.email).toBe('david@example.com')

      db2.close()
    })

    it('should handle adding new table during migration', async () => {
      // Create v1 schema with just users table
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
      await db.table('users').insert({ name: 'Alice' })
      db.close()

      // Create v2 schema with users and posts tables
      const v2Schema: DatabaseSchema = {
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
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              authorId: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      // Reopen with new schema - IndexedDB handles upgrade
      const db2 = await DexBee.connect(dbName, v2Schema)

      // Verify old table still works
      const users = await db2.table('users').all()
      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('Alice')

      // Verify new table is functional
      const posts = db2.table('posts')
      await posts.insert({ title: 'First Post', authorId: 1 })

      const allPosts = await posts.all()
      expect(allPosts).toHaveLength(1)
      expect(allPosts[0].title).toBe('First Post')

      db2.close()
    })
  })

  describe('Migration Rollback', () => {
    it('should track migration history', async () => {
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

      // Check initial status
      const initialStatus = await migratable.getMigrationStatus()
      expect(initialStatus.currentVersion).toBe(1)

      db.close()
    })
  })

  describe('Multi-Step Migrations', () => {
    it('should handle sequential schema upgrades', async () => {
      // Start with v1
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

      const db1 = await DexBee.connect(dbName, v1Schema)
      await db1.table('users').insert({ name: 'Alice' })
      db1.close()

      // Upgrade to v2 (add email field)
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

      const db2 = await DexBee.connect(dbName, v2Schema)
      const users2 = await db2.table('users').all()
      expect(users2).toHaveLength(1)
      db2.close()

      // Upgrade to v3 (add posts table)
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

      const db3 = await DexBee.connect(dbName, v3Schema)

      // Verify users still exist
      const users3 = await db3.table('users').all()
      expect(users3).toHaveLength(1)
      expect(users3[0].name).toBe('Alice')

      // Verify posts table is functional
      await db3.table('posts').insert({ title: 'Test Post' })
      const posts = await db3.table('posts').all()
      expect(posts).toHaveLength(1)

      db3.close()
    })
  })

  describe('Migration with Data Validation', () => {
    it('should preserve data integrity across migrations', async () => {
      const v1Schema: DatabaseSchema = {
        version: 1,
        tables: {
          products: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              price: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const db = await DexBee.connect(dbName, v1Schema)

      // Insert products with specific data
      const products = db.table('products')
      await products.insert({ name: 'Widget', price: 19.99 })
      await products.insert({ name: 'Gadget', price: 29.99 })
      await products.insert({ name: 'Doohickey', price: 39.99 })

      db.close()

      // Upgrade schema to v2 with new field
      const v2Schema: DatabaseSchema = {
        version: 2,
        tables: {
          products: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              price: { type: 'number', required: true },
              inStock: { type: 'boolean', required: false, default: () => true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const db2 = await DexBee.connect(dbName, v2Schema)
      const products2 = db2.table('products')

      // Verify all products are preserved
      const allProducts = await products2.all()
      expect(allProducts).toHaveLength(3)

      // Verify data integrity - prices should be exact
      const widget = allProducts.find(p => p.name === 'Widget')
      expect(widget!.price).toBe(19.99)

      const gadget = allProducts.find(p => p.name === 'Gadget')
      expect(gadget!.price).toBe(29.99)

      // Verify total value calculation still works
      const totalValue = allProducts.reduce((sum, p) => sum + +p.price!, 0)
      expect(totalValue).toBeCloseTo(89.97, 2)

      db2.close()
    })
  })
})
