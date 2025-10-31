import type { DatabaseSchema } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { DropTableOperation } from '../../../src/migration/operations/drop-table-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('DropTableOperation', () => {
  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const operation = new DropTableOperation('users')

      expect(operation.type).toBe('dropTable')
      expect(operation.tableName).toBe('users')
    })
  })

  describe('validate', () => {
    const baseOldSchema: DatabaseSchema = {
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

    it('should validate dropping table successfully', () => {
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
          // posts is dropped
        },
      }

      const operation = new DropTableOperation('posts')

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should throw when table does not exist in old schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
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

      const operation = new DropTableOperation('comments')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in the old schema/,
      )
    })

    it('should throw when table still exists in new schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
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

      const operation = new DropTableOperation('posts')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /still exists in the new schema/,
      )
    })

    it('should handle dropping last table', () => {
      const oldSchema: DatabaseSchema = {
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

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new DropTableOperation('users')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('should handle dropping table with indexes', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
            indexes: [
              { name: 'email_idx', keyPath: 'email' },
              { name: 'email_unique_idx', keyPath: 'email', unique: true },
            ],
          },
        },
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new DropTableOperation('users')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('should handle dropping table with many fields', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
              age: { type: 'number', required: false },
              address: { type: 'string', required: false },
              phone: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new DropTableOperation('users')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute successfully when table exists', async () => {
      const deleteObjectStoreSpy = vi.fn()
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn((name: string) => name === 'users'),
        },
        deleteObjectStore: deleteObjectStoreSpy,
      } as any

      const operation = new DropTableOperation('users')

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(deleteObjectStoreSpy).toHaveBeenCalledWith('users')
    })

    it('should throw when table does not exist', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        deleteObjectStore: vi.fn(),
      } as any

      const operation = new DropTableOperation('nonexistent')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should handle execution errors gracefully', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        deleteObjectStore: vi.fn(() => {
          throw new Error('Failed to delete object store')
        }),
      } as any

      const operation = new DropTableOperation('users')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to drop table/,
      )
    })

    it('should properly wrap non-Error exceptions', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw 'String error' // eslint-disable-line no-throw-literal
          }),
        },
        deleteObjectStore: vi.fn(),
      } as any

      const operation = new DropTableOperation('users')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
    })

    it('should handle IndexedDB-specific errors', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        deleteObjectStore: vi.fn(() => {
          const error = new Error('ConstraintError')
          error.name = 'ConstraintError'
          throw error
        }),
      } as any

      const operation = new DropTableOperation('users')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to drop table/,
      )
    })
  })

  describe('edge cases', () => {
    it('should handle table names with special characters', () => {
      const operation = new DropTableOperation('user_accounts')
      expect(operation.tableName).toBe('user_accounts')
    })

    it('should handle very long table names', () => {
      const longName = `table_${'a'.repeat(100)}`
      const operation = new DropTableOperation(longName)
      expect(operation.tableName).toBe(longName)
    })

    it('should handle table with special properties', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true, unique: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new DropTableOperation('users')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const operation = new DropTableOperation('users')
      expect(operation.type).toBe('dropTable')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        deleteObjectStore: vi.fn(),
      } as any

      const operation = new DropTableOperation('nonexistent')

      try {
        await operation.execute(mockDB)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.MIGRATION_EXECUTION_FAILED)
      }
    })

    it('should use correct error code for validation failures', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {},
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new DropTableOperation('users')

      try {
        operation.validate(oldSchema, newSchema)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.MIGRATION_VALIDATION_FAILED)
      }
    })
  })

  describe('data safety', () => {
    it('should actually delete table from database', async () => {
      const deleteObjectStoreSpy = vi.fn()
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        deleteObjectStore: deleteObjectStoreSpy,
      } as any

      const operation = new DropTableOperation('users')
      await operation.execute(mockDB)

      expect(deleteObjectStoreSpy).toHaveBeenCalledTimes(1)
      expect(deleteObjectStoreSpy).toHaveBeenCalledWith('users')
    })

    it('should not call deleteObjectStore when table does not exist', async () => {
      const deleteObjectStoreSpy = vi.fn()
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        deleteObjectStore: deleteObjectStoreSpy,
      } as any

      const operation = new DropTableOperation('nonexistent')

      await expect(operation.execute(mockDB)).rejects.toThrow()
      expect(deleteObjectStoreSpy).not.toHaveBeenCalled()
    })
  })
})
