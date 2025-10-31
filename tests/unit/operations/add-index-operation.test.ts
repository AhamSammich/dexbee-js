import type { DatabaseSchema } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { AddIndexOperation, DropIndexOperation } from '../../../src/migration/operations/add-index-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('AddIndexOperation', () => {
  const createMockDB = (): IDBDatabase => ({
    objectStoreNames: {
      contains: vi.fn((name: string) => name === 'users'),
      length: 1,
      item: vi.fn(),
    } as any,
  } as any)

  describe('constructor', () => {
    it('should create operation with correct properties for single-field index', () => {
      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      expect(operation.type).toBe('addIndex')
      expect(operation.tableName).toBe('users')
      expect(operation.indexName).toBe('email_idx')
      expect(operation.keyPath).toBe('email')
    })

    it('should create operation with compound index', () => {
      const operation = new AddIndexOperation(
        'users',
        'name_email_idx',
        ['name', 'email'],
      )

      expect(operation.type).toBe('addIndex')
      expect(operation.keyPath).toEqual(['name', 'email'])
    })

    it('should accept index options', () => {
      const options: IDBIndexParameters = { unique: true }
      const operation = new AddIndexOperation('users', 'email_idx', 'email', options)

      expect(operation.options).toEqual(options)
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
            email: { type: 'string', required: false },
          },
          primaryKey: 'id',
          autoIncrement: true,
        },
      },
    }

    it('should validate adding single-field index successfully', () => {
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
            indexes: [{ name: 'email_idx', keyPath: 'email' }],
          },
        },
      }

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should validate adding compound index successfully', () => {
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
            indexes: [{ name: 'name_email_idx', keyPath: ['name', 'email'] }],
          },
        },
      }

      const operation = new AddIndexOperation(
        'users',
        'name_email_idx',
        ['name', 'email'],
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should validate adding unique index', () => {
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
            indexes: [{ name: 'email_idx', keyPath: 'email', unique: true }],
          },
        },
      }

      const operation = new AddIndexOperation(
        'users',
        'email_idx',
        'email',
        { unique: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should throw when table does not exist in old schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
            indexes: [{ name: 'title_idx', keyPath: 'title' }],
          },
        },
      }

      const operation = new AddIndexOperation('posts', 'title_idx', 'title')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in old schema/,
      )
    })

    it('should throw when table does not exist in new schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when single-field index targets non-existent field', () => {
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
            indexes: [{ name: 'email_idx', keyPath: 'email' }],
          },
        },
      }

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /field does not exist/,
      )
    })

    it('should throw when compound index contains non-existent field', () => {
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
            indexes: [{ name: 'name_email_idx', keyPath: ['name', 'email'] }],
          },
        },
      }

      const operation = new AddIndexOperation(
        'users',
        'name_email_idx',
        ['name', 'email'],
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /field 'email' does not exist/,
      )
    })

    it('should throw when index name already exists', () => {
      const oldSchemaWithIndex: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
            indexes: [{ name: 'email_idx', keyPath: 'email' }],
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
            indexes: [{ name: 'email_idx', keyPath: 'email' }],
          },
        },
      }

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      expect(() => operation.validate(oldSchemaWithIndex, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(oldSchemaWithIndex, newSchema)).toThrow(
        /already exists/,
      )
    })

    it('should handle table with no existing indexes', () => {
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
            indexes: [{ name: 'email_idx', keyPath: 'email' }],
          },
        },
      }

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should validate multi-field compound index with all valid fields', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              firstName: { type: 'string', required: true },
              lastName: { type: 'string', required: true },
              email: { type: 'string', required: false },
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
              firstName: { type: 'string', required: true },
              lastName: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
            indexes: [
              { name: 'name_idx', keyPath: ['lastName', 'firstName'] },
            ],
          },
        },
      }

      const operation = new AddIndexOperation(
        'users',
        'name_idx',
        ['lastName', 'firstName'],
      )

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute successfully when table exists', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockDB = createMockDB()
      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adding index'),
      )

      consoleSpy.mockRestore()
    })

    it('should throw when table does not exist', async () => {
      const mockDB = createMockDB()
      const operation = new AddIndexOperation('nonexistent', 'idx', 'field')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should handle execution errors gracefully', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw new Error('Database error')
          }),
        },
      } as any

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to add index/,
      )
    })

    it('should properly wrap non-Error exceptions', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw 'String error' // eslint-disable-line no-throw-literal
          }),
        },
      } as any

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
    })
  })

  describe('edge cases', () => {
    it('should handle index names with special characters', () => {
      const operation = new AddIndexOperation('users', 'email_unique_idx', 'email')
      expect(operation.indexName).toBe('email_unique_idx')
    })

    it('should handle very long index names', () => {
      const longName = `idx_${'a'.repeat(100)}`
      const operation = new AddIndexOperation('users', longName, 'email')
      expect(operation.indexName).toBe(longName)
    })

    it('should handle compound index with many fields', () => {
      const fields = ['field1', 'field2', 'field3', 'field4', 'field5']
      const operation = new AddIndexOperation('users', 'multi_idx', fields)
      expect(operation.keyPath).toEqual(fields)
    })

    it('should preserve index options', () => {
      const options = { unique: true, multiEntry: false }
      const operation = new AddIndexOperation('users', 'email_idx', 'email', options)
      expect(operation.options).toEqual(options)
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const operation = new AddIndexOperation('users', 'email_idx', 'email')
      expect(operation.type).toBe('addIndex')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = createMockDB()
      const operation = new AddIndexOperation('nonexistent', 'idx', 'field')

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

      const operation = new AddIndexOperation('users', 'email_idx', 'email')

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
})

describe('DropIndexOperation', () => {
  const createMockDB = (): IDBDatabase => ({
    objectStoreNames: {
      contains: vi.fn((name: string) => name === 'users'),
      length: 1,
      item: vi.fn(),
    } as any,
  } as any)

  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const operation = new DropIndexOperation('users', 'email_idx')

      expect(operation.type).toBe('dropIndex')
      expect(operation.tableName).toBe('users')
      expect(operation.indexName).toBe('email_idx')
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
            email: { type: 'string', required: false },
          },
          primaryKey: 'id',
          autoIncrement: true,
          indexes: [{ name: 'email_idx', keyPath: 'email' }],
        },
      },
    }

    it('should validate dropping index successfully', () => {
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
            // email_idx is dropped
          },
        },
      }

      const operation = new DropIndexOperation('users', 'email_idx')

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

      const operation = new DropIndexOperation('posts', 'title_idx')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in old schema/,
      )
    })

    it('should throw when table does not exist in new schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const operation = new DropIndexOperation('users', 'email_idx')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when index does not exist in old schema', () => {
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
            // No indexes
          },
        },
      }

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new DropIndexOperation('users', 'email_idx')

      expect(() => operation.validate(oldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(oldSchema, newSchema)).toThrow(
        /does not exist on table/,
      )
    })

    it('should throw when index still exists in new schema', () => {
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
            indexes: [{ name: 'email_idx', keyPath: 'email' }], // Still exists
          },
        },
      }

      const operation = new DropIndexOperation('users', 'email_idx')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /still exists in new schema/,
      )
    })

    it('should handle table with no indexes in old schema', () => {
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

      const operation = new DropIndexOperation('users', 'email_idx')

      expect(() => operation.validate(oldSchema, newSchema)).toThrow(DexBeeError)
    })
  })

  describe('execute', () => {
    it('should execute successfully when table exists', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const mockDB = createMockDB()
      const operation = new DropIndexOperation('users', 'email_idx')

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dropping index'),
      )

      consoleSpy.mockRestore()
    })

    it('should throw when table does not exist', async () => {
      const mockDB = createMockDB()
      const operation = new DropIndexOperation('nonexistent', 'email_idx')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should handle execution errors gracefully', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw new Error('Database error')
          }),
        },
      } as any

      const operation = new DropIndexOperation('users', 'email_idx')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to drop index/,
      )
    })

    it('should properly wrap non-Error exceptions', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw 'String error' // eslint-disable-line no-throw-literal
          }),
        },
      } as any

      const operation = new DropIndexOperation('users', 'email_idx')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const operation = new DropIndexOperation('users', 'email_idx')
      expect(operation.type).toBe('dropIndex')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = createMockDB()
      const operation = new DropIndexOperation('nonexistent', 'idx')

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

      const operation = new DropIndexOperation('users', 'email_idx')

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
})
