import type { DatabaseSchema, TableConfig } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { AddTableOperation } from '../../../src/migration/operations/add-table-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('AddTableOperation', () => {
  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      expect(operation.type).toBe('addTable')
      expect(operation.tableName).toBe('users')
      expect(operation.tableConfig).toEqual(tableConfig)
    })

    it('should handle table config with indexes', () => {
      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          email: { type: 'string', required: false },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [{ name: 'email_idx', keyPath: 'email' }],
      }

      const operation = new AddTableOperation('users', tableConfig)

      expect(operation.tableConfig.indexes).toBeDefined()
      expect(operation.tableConfig.indexes).toHaveLength(1)
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
      },
    }

    it('should validate adding new table successfully', () => {
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
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          title: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('posts', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should throw when table already exists in old schema', () => {
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

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /already exists in the old schema/,
      )
    })

    it('should throw when table does not exist in new schema', () => {
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

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          title: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('posts', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in the new schema/,
      )
    })

    it('should throw when table has no fields', () => {
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
            schema: {},
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const tableConfig: TableConfig = {
        schema: {},
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('posts', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /must have at least one field/,
      )
    })

    it('should throw when primary key is not in schema', () => {
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
              title: { type: 'string', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const tableConfig: TableConfig = {
        schema: {
          title: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('posts', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /Primary key .* is not defined in schema/,
      )
    })

    it('should validate table without primary key', () => {
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
          logs: {
            schema: {
              message: { type: 'string', required: true },
              timestamp: { type: 'date', required: true },
            },
          },
        },
      }

      const tableConfig: TableConfig = {
        schema: {
          message: { type: 'string', required: true },
          timestamp: { type: 'date', required: true },
        },
      }

      const operation = new AddTableOperation('logs', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    // Note: Compound primary keys are not currently supported
    // The primaryKey field in TableConfig is typed as 'string', not 'string | string[]'
    // If this feature is added in the future, add tests here for:
    // - Validation of compound primary keys
    // - Execution with multiple key paths
    // - Error handling when one key field is missing

    it('should validate table with indexes', () => {
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
              authorId: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
            indexes: [
              { name: 'author_idx', keyPath: 'authorId' },
              { name: 'title_idx', keyPath: 'title' },
            ],
          },
        },
      }

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          title: { type: 'string', required: true },
          authorId: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'author_idx', keyPath: 'authorId' },
          { name: 'title_idx', keyPath: 'title' },
        ],
      }

      const operation = new AddTableOperation('posts', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should validate table with unique fields', () => {
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
          accounts: {
            schema: {
              id: { type: 'number', required: true },
              email: { type: 'string', required: true, unique: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          email: { type: 'string', required: true, unique: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('accounts', tableConfig)

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute successfully and create table', async () => {
      const createIndexSpy = vi.fn()
      const mockStore = {
        createIndex: createIndexSpy,
      }
      const createObjectStoreSpy = vi.fn(() => mockStore)

      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: createObjectStoreSpy,
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(createObjectStoreSpy).toHaveBeenCalledWith('users', {
        keyPath: 'id',
        autoIncrement: true,
      })
    })

    it('should create indexes when specified', async () => {
      const createIndexSpy = vi.fn()
      const mockStore = {
        createIndex: createIndexSpy,
      }
      const createObjectStoreSpy = vi.fn(() => mockStore)

      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: createObjectStoreSpy,
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          email: { type: 'string', required: false },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [{ name: 'email_idx', keyPath: 'email' }],
      }

      const operation = new AddTableOperation('users', tableConfig)

      await operation.execute(mockDB)

      expect(createIndexSpy).toHaveBeenCalledWith('email_idx', 'email_idx')
    })

    it('should create unique indexes for fields with unique constraint', async () => {
      const createIndexSpy = vi.fn()
      const mockStore = {
        createIndex: createIndexSpy,
      }
      const createObjectStoreSpy = vi.fn(() => mockStore)

      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: createObjectStoreSpy,
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          email: { type: 'string', required: false, unique: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      await operation.execute(mockDB)

      expect(createIndexSpy).toHaveBeenCalledWith('email_unique', 'email', { unique: true })
    })

    it('should throw when table already exists', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        createObjectStore: vi.fn(),
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /already exists/,
      )
    })

    it('should handle execution errors gracefully', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: vi.fn(() => {
          throw new Error('Failed to create object store')
        }),
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to create table/,
      )
    })

    it('should warn on index creation failures but not fail migration', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockStore = {
        createIndex: vi.fn(() => {
          throw new Error('Index creation failed')
        }),
      }
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: vi.fn(() => mockStore),
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          email: { type: 'string', required: false },
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [{ name: 'email_idx', keyPath: 'email' }],
      }

      const operation = new AddTableOperation('users', tableConfig)

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()
      // Check that the first argument contains the expected text
      expect(consoleSpy.mock.calls[0][0]).toContain('Failed to create index')

      consoleSpy.mockRestore()
    })

    it('should create table without autoIncrement', async () => {
      const createObjectStoreSpy = vi.fn(() => ({
        createIndex: vi.fn(),
      }))

      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: createObjectStoreSpy,
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        primaryKey: 'id',
        autoIncrement: false,
      }

      const operation = new AddTableOperation('users', tableConfig)

      await operation.execute(mockDB)

      expect(createObjectStoreSpy).toHaveBeenCalledWith('users', {
        keyPath: 'id',
      })
    })

    it('should not skip unique index on primary key field', async () => {
      const createIndexSpy = vi.fn()
      const mockStore = {
        createIndex: createIndexSpy,
      }
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: vi.fn(() => mockStore),
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true, unique: true },
          email: { type: 'string', required: false, unique: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      await operation.execute(mockDB)

      // Should only create unique index for email, not for id (primary key)
      expect(createIndexSpy).toHaveBeenCalledTimes(1)
      expect(createIndexSpy).toHaveBeenCalledWith('email_unique', 'email', { unique: true })
    })
  })

  describe('edge cases', () => {
    it('should handle table with many fields', () => {
      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
          field1: { type: 'string', required: false },
          field2: { type: 'string', required: false },
          field3: { type: 'string', required: false },
          field4: { type: 'string', required: false },
          field5: { type: 'string', required: false },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('complex_table', tableConfig)

      expect(operation.tableConfig.schema).toHaveProperty('field5')
    })

    it('should handle table names with special characters', () => {
      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('user_accounts', tableConfig)

      expect(operation.tableName).toBe('user_accounts')
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

      expect(operation.type).toBe('addTable')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        createObjectStore: vi.fn(),
      } as any

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

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

      const tableConfig: TableConfig = {
        schema: {
          id: { type: 'number', required: true },
        },
        primaryKey: 'id',
        autoIncrement: true,
      }

      const operation = new AddTableOperation('users', tableConfig)

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
