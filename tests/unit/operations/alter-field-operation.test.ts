import type { DatabaseSchema, FieldDefinition } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { AlterFieldOperation } from '../../../src/migration/operations/alter-field-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('AlterFieldOperation', () => {
  const createMockDB = (): IDBDatabase => ({
    objectStoreNames: {
      contains: vi.fn((name: string) => name === 'users'),
      length: 1,
      item: vi.fn(),
    } as any,
  } as any)

  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const oldDef: FieldDefinition = { type: 'string', required: false }
      const newDef: FieldDefinition = { type: 'string', required: true }
      const operation = new AlterFieldOperation('users', 'email', oldDef, newDef)

      expect(operation.type).toBe('alterField')
      expect(operation.tableName).toBe('users')
      expect(operation.fieldName).toBe('email')
      expect(operation.oldDefinition).toEqual(oldDef)
      expect(operation.newDefinition).toEqual(newDef)
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

    it('should validate changing field from optional to required', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const newSchema: DatabaseSchema = {
        version: 2,
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

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()

      consoleSpy.mockRestore()
    })

    it('should validate changing field from required to optional', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
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
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: true },
        { type: 'string', required: false },
      )

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('should validate type change from string to string', () => {
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

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: false },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should warn when changing incompatible types', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'number', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'number', required: false },
      )

      operation.validate(baseOldSchema, newSchema)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may cause data loss'),
      )

      consoleSpy.mockRestore()
    })

    it('should allow date to string type conversion', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              createdAt: { type: 'date', required: true },
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
              createdAt: { type: 'string', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'createdAt',
        { type: 'date', required: true },
        { type: 'string', required: true },
      )

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('should throw when table does not exist in old schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          posts: {
            schema: {
              id: { type: 'number', required: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'posts',
        'title',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

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

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

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
              age: { type: 'number', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'age',
        { type: 'number', required: false },
        { type: 'number', required: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in old schema/,
      )
    })

    it('should throw when field does not exist in new schema', () => {
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

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when altering primary key type', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'string', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: false,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'id',
        { type: 'number', required: true },
        { type: 'string', required: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /primary key field/,
      )
    })

    it('should throw when making primary key optional', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: false },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'id',
        { type: 'number', required: true },
        { type: 'number', required: false },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
    })

    it('should throw when making primary key nullable', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true, nullable: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'id',
        { type: 'number', required: true },
        { type: 'number', required: true, nullable: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
    })

    it('should handle adding unique constraint', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false, unique: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: false, unique: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should handle removing unique constraint', () => {
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
              email: { type: 'string', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, unique: true },
        { type: 'string', required: false },
      )

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })

    it('should handle changing default value', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false, default: () => 'new@example.com' },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, default: () => 'old@example.com' },
        { type: 'string', required: false, default: () => 'new@example.com' },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should handle making field nullable', () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              email: { type: 'string', required: false, nullable: false },
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
              email: { type: 'string', required: false, nullable: true },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, nullable: false },
        { type: 'string', required: false, nullable: true },
      )

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute successfully when table exists', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should throw when table does not exist', async () => {
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'nonexistent',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should log warnings when changing field type', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'number', required: false },
      )

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Changing type'),
      )

      consoleSpy.mockRestore()
    })

    it('should log warnings when making field required', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Making field'),
      )

      consoleSpy.mockRestore()
    })

    it('should log info when making field optional', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: true },
        { type: 'string', required: false },
      )

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('optional'),
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

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to alter field/,
      )
    })
  })

  describe('edge cases', () => {
    it('should handle multiple simultaneous changes', async () => {
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, nullable: true },
        { type: 'string', required: true, unique: true, nullable: false },
      )

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
    })

    it('should handle field with no changes', async () => {
      const mockDB = createMockDB()

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: false },
      )

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

      expect(operation.type).toBe('alterField')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = createMockDB()
      const operation = new AlterFieldOperation(
        'nonexistent',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

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

      const operation = new AlterFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
        { type: 'string', required: true },
      )

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
