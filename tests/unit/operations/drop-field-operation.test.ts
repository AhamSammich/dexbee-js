import type { DatabaseSchema } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { DropFieldOperation } from '../../../src/migration/operations/drop-field-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('DropFieldOperation', () => {
  const createMockDB = (): IDBDatabase => ({
    objectStoreNames: {
      contains: vi.fn((name: string) => name === 'users'),
      length: 1,
      item: vi.fn(),
    } as any,
  } as any)

  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const operation = new DropFieldOperation('users', 'email')

      expect(operation.type).toBe('dropField')
      expect(operation.tableName).toBe('users')
      expect(operation.fieldName).toBe('email')
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
            age: { type: 'number', required: false },
          },
          primaryKey: 'id',
          autoIncrement: true,
        },
      },
    }

    it('should validate dropping optional field successfully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              age: { type: 'number', required: false },
              // email is dropped
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new DropFieldOperation('users', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may result in data loss'),
      )

      consoleSpy.mockRestore()
    })

    it('should validate dropping required field', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: true },
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
              // email is dropped
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new DropFieldOperation('users', 'email')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
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

      const operation = new DropFieldOperation('posts', 'title')

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

      const operation = new DropFieldOperation('users', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when field does not exist in old schema', () => {
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

      const operation = new DropFieldOperation('users', 'nonexistent')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in table/,
      )
    })

    it('should throw when field still exists in new schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false }, // Still exists
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new DropFieldOperation('users', 'email')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /still exists in new schema/,
      )
    })

    it('should throw when trying to drop primary key field', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'name',
            autoIncrement: false,
          },
        },
      }

      const operation = new DropFieldOperation('users', 'id')

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /it is the primary key/,
      )
    })

    it('should warn about data loss', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

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

      const operation = new DropFieldOperation('users', 'email')
      operation.validate(baseOldSchema, newSchema)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may result in data loss'),
      )

      consoleSpy.mockRestore()
    })

    it('should handle dropping field with unique constraint', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              email: { type: 'string', required: false, unique: true },
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

      const operation = new DropFieldOperation('users', 'email')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('should handle dropping field with index', () => {
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
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new DropFieldOperation('users', 'email')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute successfully when table exists', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockDB = createMockDB()
      const operation = new DropFieldOperation('users', 'email')

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dropping field'),
      )

      consoleSpy.mockRestore()
    })

    it('should throw when table does not exist', async () => {
      const mockDB = createMockDB()
      const operation = new DropFieldOperation('nonexistent', 'email')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should warn about field data remaining', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockDB = createMockDB()
      const operation = new DropFieldOperation('users', 'email')

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('existing data will remain'),
      )

      consoleSpy.mockRestore()
    })

    it('should handle execution errors gracefully', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw new Error('Database error')
          }),
        },
      } as any

      const operation = new DropFieldOperation('users', 'email')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to drop field/,
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

      const operation = new DropFieldOperation('users', 'email')

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
    })
  })

  describe('edge cases', () => {
    it('should handle field names with special characters', () => {
      const operation = new DropFieldOperation('users', 'user_email_address')
      expect(operation.fieldName).toBe('user_email_address')
    })

    it('should handle very long field names', () => {
      const longName = 'a'.repeat(100)
      const operation = new DropFieldOperation('users', longName)
      expect(operation.fieldName).toBe(longName)
    })

    it('should handle dropping last non-primary-key field', () => {
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
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new DropFieldOperation('users', 'name')

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const operation = new DropFieldOperation('users', 'email')
      expect(operation.type).toBe('dropField')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = createMockDB()
      const operation = new DropFieldOperation('nonexistent', 'email')

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

      const operation = new DropFieldOperation('users', 'email')

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
