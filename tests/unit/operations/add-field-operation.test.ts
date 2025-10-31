import type { DatabaseSchema, FieldDefinition } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { AddFieldOperation } from '../../../src/migration/operations/add-field-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('AddFieldOperation', () => {
  const createMockDB = (): IDBDatabase => ({
    objectStoreNames: {
      contains: vi.fn((name: string) => name === 'users'),
      length: 1,
      item: vi.fn(),
    } as any,
  } as any)

  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const fieldDef: FieldDefinition = { type: 'string', required: false }
      const operation = new AddFieldOperation('users', 'email', fieldDef)

      expect(operation.type).toBe('addField')
      expect(operation.tableName).toBe('users')
      expect(operation.fieldName).toBe('email')
      expect(operation.fieldDefinition).toEqual(fieldDef)
    })

    it('should handle various field types', () => {
      const fieldTypes: FieldDefinition[] = [
        { type: 'string', required: true },
        { type: 'number', required: true },
        { type: 'boolean', required: false },
        { type: 'date', required: false },
        { type: 'object', required: false },
        { type: 'array', required: false },
      ]

      fieldTypes.forEach((fieldDef) => {
        const operation = new AddFieldOperation('users', 'testField', fieldDef)
        expect(operation.fieldDefinition.type).toBe(fieldDef.type)
      })
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

    it('should validate adding optional field successfully', () => {
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should validate adding required field with default value', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              status: { type: 'string', required: true, default: () => 'active' },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AddFieldOperation(
        'users',
        'status',
        { type: 'string', required: true, default: () => 'active' },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should warn when adding required field without default', () => {
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: true },
      )

      operation.validate(baseOldSchema, newSchema)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adding required field'),
      )

      consoleSpy.mockRestore()
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
          },
        },
      }

      const operation = new AddFieldOperation(
        'posts',
        'content',
        { type: 'string', required: false },
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when field already exists in old schema', () => {
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

      const operation = new AddFieldOperation(
        'users',
        'name', // Already exists
        { type: 'string', required: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /already exists/,
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
              // email is not here
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when field definition has no type', () => {
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        {} as FieldDefinition, // No type
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseOldSchema, newSchema)).toThrow(
        /must have a type defined/,
      )
    })

    it('should handle adding field with unique constraint', () => {
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, unique: true },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should handle adding field with default value', () => {
      const defaultValue = () => 'default@example.com'
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false, default: defaultValue },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, default: defaultValue },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })

    it('should handle adding blob field type', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              avatar: { type: 'blob', required: false },
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const operation = new AddFieldOperation(
        'users',
        'avatar',
        { type: 'blob', required: false },
      )

      expect(() => operation.validate(baseOldSchema, newSchema)).not.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute successfully when table exists', async () => {
      const mockDB = createMockDB()
      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
    })

    it('should throw when table does not exist', async () => {
      const mockDB = createMockDB()
      const operation = new AddFieldOperation(
        'nonexistent',
        'email',
        { type: 'string', required: false },
      )

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should warn when adding unique field', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockDB = createMockDB()
      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false, unique: true },
      )

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adding unique field'),
      )

      consoleSpy.mockRestore()
    })

    it('should log info when adding field with default', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const mockDB = createMockDB()
      const operation = new AddFieldOperation(
        'users',
        'status',
        { type: 'string', required: false, default: () => 'active' },
      )

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('added with default value'),
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to add field/,
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
    })
  })

  describe('edge cases', () => {
    it('should handle field names with special characters', () => {
      const operation = new AddFieldOperation(
        'users',
        'user_email_address',
        { type: 'string', required: false },
      )

      expect(operation.fieldName).toBe('user_email_address')
    })

    it('should handle very long field names', () => {
      const longName = 'a'.repeat(100)
      const operation = new AddFieldOperation(
        'users',
        longName,
        { type: 'string', required: false },
      )

      expect(operation.fieldName).toBe(longName)
    })

    it('should handle nullable field definitions', () => {
      const operation = new AddFieldOperation(
        'users',
        'middleName',
        { type: 'string', required: false, nullable: true },
      )

      expect(operation.fieldDefinition.nullable).toBe(true)
    })

    it('should handle field with both default and required', () => {
      const operation = new AddFieldOperation(
        'users',
        'role',
        { type: 'string', required: true, default: () => 'user' },
      )

      expect(operation.fieldDefinition.required).toBe(true)
      expect(operation.fieldDefinition.default).toBeDefined()
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
      )

      expect(operation.type).toBe('addField')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = createMockDB()
      const operation = new AddFieldOperation(
        'nonexistent',
        'email',
        { type: 'string', required: false },
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

      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false },
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
