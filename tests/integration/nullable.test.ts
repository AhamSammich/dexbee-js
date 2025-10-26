import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DexBee, type Database } from '../../src/index.js'
import { defineSchema } from '../../src/helpers/define-schema.js'
import type { InferTableType } from '../../src/types/infer.js'
import { DexBeeError } from '../../src/types/errors.js'

describe('Nullable Field Functionality', () => {
  let db: Database<any>
  const dbName = 'test-nullable-db'

  afterEach(async () => {
    if (db && db.isConnected()) {
      db.close()
    }
  })

  describe('Type Inference', () => {
    it('should infer required + nullable: false as T', () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true, nullable: false },
            },
            primaryKey: 'id',
          },
        },
      })

      type TestType = InferTableType<typeof schema, 'test'>
      // Type should be: { id: number, name: string }
      const testValue: TestType = { id: 1, name: 'test' }
      expect(testValue).toBeDefined()

      // @ts-expect-error - should not allow null for nullable: false
      const invalidValue: TestType = { id: 1, name: null }
      expect(invalidValue).toBeDefined() // runtime check doesn't matter for type test
    })

    it('should infer required + nullable: true as T | null', () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true, nullable: true },
            },
            primaryKey: 'id',
          },
        },
      })

      type TestType = InferTableType<typeof schema, 'test'>
      // Type should be: { id: number, name: string | null }
      const testValue: TestType = { id: 1, name: null }
      expect(testValue).toBeDefined()
    })

    it('should infer optional + nullable: false as T | undefined', () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', nullable: false },
            },
            primaryKey: 'id',
          },
        },
      })

      type TestType = InferTableType<typeof schema, 'test'>
      // Type should be: { id: number, name?: string }
      const testValue1: TestType = { id: 1 }
      const testValue2: TestType = { id: 1, name: 'test' }
      expect(testValue1).toBeDefined()
      expect(testValue2).toBeDefined()

      // @ts-expect-error - should not allow null for nullable: false
      const invalidValue: TestType = { id: 1, name: null }
      expect(invalidValue).toBeDefined() // runtime check doesn't matter for type test
    })

    it('should infer optional + nullable: true as T | null | undefined', () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', nullable: true },
            },
            primaryKey: 'id',
          },
        },
      })

      type TestType = InferTableType<typeof schema, 'test'>
      // Type should be: { id: number, name?: string | null }
      const testValue1: TestType = { id: 1 }
      const testValue2: TestType = { id: 1, name: 'test' }
      const testValue3: TestType = { id: 1, name: null }
      expect(testValue1).toBeDefined()
      expect(testValue2).toBeDefined()
      expect(testValue3).toBeDefined()
    })

    it('should default to nullable: true for backward compatibility', () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string' }, // no nullable specified
            },
            primaryKey: 'id',
          },
        },
      })

      type TestType = InferTableType<typeof schema, 'test'>
      // Type should be: { id: number, name?: string | null | undefined }
      const testValue: TestType = { id: 1, name: null }
      expect(testValue).toBeDefined()
    })
  })

  describe('Validation Behavior', () => {
    it('should reject null values when nullable: false', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true, nullable: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const users = db.table('users')

      await expect(
        users.insert({ name: null as any }),
      ).rejects.toThrow('cannot be null')
    })

    it('should allow null values when nullable: true', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', nullable: true },
              email: { type: 'string', required: true, nullable: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const users = db.table('users')

      const result = await users.insert({ name: null, email: null })
      expect(result).toBeDefined()
      expect(result.name).toBeNull()
      expect(result.email).toBeNull()
    })

    it('should allow null values by default (backward compatibility)', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string' }, // no nullable flag
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const users = db.table('users')

      const result = await users.insert({ name: null })
      expect(result).toBeDefined()
      expect(result.name).toBeNull()
    })

    it('should still reject undefined for required fields', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true, nullable: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const users = db.table('users')

      // Required field missing (undefined) should fail
      await expect(
        users.insert({}),
      ).rejects.toThrow('Required field')

      // But required field set to null should work
      const result = await users.insert({ name: null })
      expect(result.name).toBeNull()
    })

    it('should handle nullable with different field types', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          records: {
            schema: {
              id: { type: 'number', required: true },
              count: { type: 'number', nullable: true },
              active: { type: 'boolean', nullable: true },
              createdAt: { type: 'date', nullable: true },
              tags: { type: 'array', nullable: true },
              metadata: { type: 'object', nullable: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const records = db.table('records')

      const result = await records.insert({
        count: null,
        active: null,
        createdAt: null,
        tags: null,
        metadata: null,
      })

      expect(result.count).toBeNull()
      expect(result.active).toBeNull()
      expect(result.createdAt).toBeNull()
      expect(result.tags).toBeNull()
      expect(result.metadata).toBeNull()
    })

    it('should reject null for non-nullable fields of different types', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          records: {
            schema: {
              id: { type: 'number', required: true },
              count: { type: 'number', nullable: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const records = db.table('records')

      await expect(
        records.insert({ count: null as any }),
      ).rejects.toThrow('cannot be null')
    })
  })

  describe('CRUD Operations with Nullable Fields', () => {
    beforeEach(async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', nullable: true },
              phone: { type: 'string', nullable: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
    })

    it('should insert records with null nullable fields', async () => {
      const users = db.table('users')

      const user = await users.insert({
        name: 'John Doe',
        email: null,
        phone: '123-456-7890',
      })

      expect(user.email).toBeNull()
      expect(user.phone).toBe('123-456-7890')
    })

    it('should update nullable fields to null', async () => {
      const users = db.table('users')

      const user = await users.insert({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
      })

      const updated = await users.update(user.id, { email: null })
      expect(updated?.email).toBeNull()
    })

    it('should query records with null values', async () => {
      const users = db.table('users')

      await users.insert({
        name: 'John Doe',
        email: null,
        phone: '123-456-7890',
      })

      await users.insert({
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '098-765-4321',
      })

      const allUsers = await users.all()
      expect(allUsers).toHaveLength(2)

      const userWithNullEmail = allUsers.find(u => u.email === null)
      expect(userWithNullEmail).toBeDefined()
      expect(userWithNullEmail?.name).toBe('John Doe')
    })

    it('should not allow updating non-nullable fields to null', async () => {
      const users = db.table('users')

      const user = await users.insert({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
      })

      await expect(
        users.update(user.id, { phone: null as any }),
      ).rejects.toThrow('cannot be null')
    })
  })

  describe('Edge Cases', () => {
    it('should handle nullable with default values', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              status: {
                type: 'string',
                nullable: true,
                default: () => 'pending',
              },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const test = db.table('test')

      // Without status field - should use default
      const result1 = await test.insert({})
      expect(result1.status).toBe('pending')

      // With explicit null - should override default
      const result2 = await test.insert({ status: null })
      expect(result2.status).toBeNull()
    })

    it('should handle nullable with custom validation', async () => {
      const schema = defineSchema({
        version: 1,
        tables: {
          test: {
            schema: {
              id: { type: 'number', required: true },
              email: {
                type: 'string',
                nullable: true,
                validate: (value: any) => {
                  // Custom validation only runs for non-null values
                  return value === null || value.includes('@')
                },
              },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      })

      db = await DexBee.connect(dbName, schema)
      const test = db.table('test')

      // Null should pass (nullable: true, and validation allows null)
      const result1 = await test.insert({ email: null })
      expect(result1.email).toBeNull()

      // Valid email should pass
      const result2 = await test.insert({ email: 'test@example.com' })
      expect(result2.email).toBe('test@example.com')

      // Invalid email should fail custom validation
      await expect(
        test.insert({ email: 'invalid-email' }),
      ).rejects.toThrow('failed custom validation')
    })
  })
})
