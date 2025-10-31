import type { DataTransformation, TransformOptions } from '../../../src/types/migration'
import type { DatabaseSchema } from '../../../src/types/schema'
import { describe, expect, it, vi } from 'vitest'
import { TransformDataOperation } from '../../../src/migration/operations/transform-data-operation'
import { DexBeeError, DexBeeErrorCode } from '../../../src/types/errors'

describe('TransformDataOperation', () => {
  const createMockDB = (): IDBDatabase => ({
    objectStoreNames: {
      contains: vi.fn((name: string) => name === 'users'),
      length: 1,
      item: vi.fn(),
    } as any,
  } as any)

  describe('constructor', () => {
    it('should create operation with correct properties', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.type).toBe('transformData')
      expect(operation.tableName).toBe('users')
      expect(operation.transformation).toEqual(transformation)
    })

    it('should accept options', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }
      const options: TransformOptions = {
        batchSize: 50,
        validateResults: true,
      }

      const operation = new TransformDataOperation('users', transformation, options)

      expect(operation.options).toEqual(options)
    })

    it('should have default empty options', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.options).toEqual({})
    })
  })

  describe('validate', () => {
    const baseSchema: DatabaseSchema = {
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

    it('should validate valid transformation', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may modify existing data'),
      )

      consoleSpy.mockRestore()
    })

    it('should validate transformation with filter', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        filter: (record: any) => !record.processed,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).not.toThrow()
    })

    it('should validate transformation with validation function', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        validate: (result: any) => result.processed === true,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).not.toThrow()
    })

    it('should validate transformation with all functions', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        filter: (record: any) => !record.processed,
        validate: (result: any) => result.processed === true,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).not.toThrow()
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

      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('posts', transformation)

      expect(() => operation.validate(baseSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseSchema, newSchema)).toThrow(
        /does not exist in old schema/,
      )
    })

    it('should throw when table does not exist in new schema', () => {
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {},
      }

      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, newSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseSchema, newSchema)).toThrow(
        /does not exist in new schema/,
      )
    })

    it('should throw when transformation is missing transform function', () => {
      const transformation = {
        // No transform function
      } as any

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(
        /must include a transform function/,
      )
    })

    it('should throw when transform is not a function', () => {
      const transformation = {
        transform: 'not a function',
      } as any

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(
        /must include a transform function/,
      )
    })

    it('should throw when filter is not a function', () => {
      const transformation = {
        transform: (record: any) => record,
        filter: 'not a function',
      } as any

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(
        /filter must be a function/,
      )
    })

    it('should throw when validate is not a function', () => {
      const transformation = {
        transform: (record: any) => record,
        validate: 'not a function',
      } as any

      const operation = new TransformDataOperation('users', transformation)

      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(DexBeeError)
      expect(() => operation.validate(baseSchema, baseSchema)).toThrow(
        /validate must be a function/,
      )
    })

    it('should warn about potential data loss', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, newField: 'value' }),
      }

      const operation = new TransformDataOperation('users', transformation)
      operation.validate(baseSchema, baseSchema)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may modify existing data'),
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('execute', () => {
    it('should execute successfully with valid transformation', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
      }

      const operation = new TransformDataOperation('users', transformation)

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting data transformation'),
      )

      consoleSpy.mockRestore()
    })

    it('should throw when table does not exist', async () => {
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('nonexistent', transformation)

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /does not exist/,
      )
    })

    it('should handle validation failure', async () => {
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: 'not a function', // Invalid
      } as any

      const operation = new TransformDataOperation('users', transformation)

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Transformation validation failed/,
      )
    })

    it('should handle transformation execution errors', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: vi.fn(() => {
            throw new Error('Database error')
          }),
        },
      } as any

      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
      await expect(operation.execute(mockDB)).rejects.toThrow(
        /Failed to transform data/,
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

      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      await expect(operation.execute(mockDB)).rejects.toThrow(DexBeeError)
    })

    it('should pass options to data transformer', async () => {
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
      }

      const options: TransformOptions = {
        batchSize: 50,
        validateResults: true,
        continueOnError: false,
      }

      const operation = new TransformDataOperation('users', transformation, options)

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
    })

    it('should log completion info on success', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
      }

      const operation = new TransformDataOperation('users', transformation)

      await operation.execute(mockDB)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting data transformation'),
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('should handle transformation that returns same record', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.transformation).toBeDefined()
    })

    it('should handle transformation with complex logic', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({
          ...record,
          fullName: `${record.firstName} ${record.lastName}`,
          age: new Date().getFullYear() - record.birthYear,
        }),
        filter: (record: any) => record.birthYear > 0,
        validate: (result: any) => result.age >= 0 && result.fullName.length > 0,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.transformation.transform).toBeDefined()
      expect(operation.transformation.filter).toBeDefined()
      expect(operation.transformation.validate).toBeDefined()
    })

    it('should handle options with all properties', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const options: TransformOptions = {
        batchSize: 100,
        validateResults: true,
        continueOnError: true,
      }

      const operation = new TransformDataOperation('users', transformation, options)

      expect(operation.options.batchSize).toBe(100)
      expect(operation.options.validateResults).toBe(true)
      expect(operation.options.continueOnError).toBe(true)
    })

    it('should handle transformation with async logic', async () => {
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: async (record: any) => {
          // Simulate async processing
          await new Promise(resolve => setTimeout(resolve, 0))
          return { ...record, processed: true }
        },
      }

      const operation = new TransformDataOperation('users', transformation)

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
    })
  })

  describe('type property', () => {
    it('should have correct type value', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.type).toBe('transformData')
    })
  })

  describe('error codes', () => {
    it('should use correct error code for execution failures', async () => {
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: 'not a function',
      } as any

      const operation = new TransformDataOperation('users', transformation)

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

      const transformation = {
        // Missing transform function
      } as any

      const operation = new TransformDataOperation('users', transformation)

      try {
        operation.validate(schema, schema)
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DexBeeError)
        expect((error as DexBeeError).code).toBe(DexBeeErrorCode.MIGRATION_VALIDATION_FAILED)
      }
    })
  })

  describe('integration with DataTransformer', () => {
    it('should create DataTransformer instance', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => record,
      }

      const operation = new TransformDataOperation('users', transformation)

      // DataTransformer is created in constructor (private field)
      expect(operation).toBeDefined()
    })

    it('should validate transformation using DataTransformer', async () => {
      const mockDB = createMockDB()

      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        filter: (record: any) => !record.processed,
        validate: (result: any) => result.processed === true,
      }

      const operation = new TransformDataOperation('users', transformation)

      await expect(operation.execute(mockDB)).resolves.not.toThrow()
    })
  })

  describe('data safety', () => {
    it('should handle transformation that modifies data', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({
          ...record,
          email: record.email.toLowerCase(),
        }),
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.transformation.transform({ email: 'TEST@EXAMPLE.COM' })).toEqual({
        email: 'test@example.com',
      })
    })

    it('should handle transformation that adds fields', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({
          ...record,
          createdAt: new Date(),
        }),
      }

      const operation = new TransformDataOperation('users', transformation)

      const result = operation.transformation.transform({ id: 1, name: 'Test' })
      expect(result).toHaveProperty('createdAt')
    })

    it('should handle transformation that removes fields', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => {
          const { password, ...rest } = record
          return rest
        },
      }

      const operation = new TransformDataOperation('users', transformation)

      const result = operation.transformation.transform({
        id: 1,
        name: 'Test',
        password: 'secret',
      })
      expect(result).not.toHaveProperty('password')
    })

    it('should handle filter that selectively processes records', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        filter: (record: any) => record.age >= 18,
      }

      const operation = new TransformDataOperation('users', transformation)

      expect(operation.transformation.filter!({ age: 20 })).toBe(true)
      expect(operation.transformation.filter!({ age: 15 })).toBe(false)
    })

    it('should handle validation that checks transformed data', () => {
      const transformation: DataTransformation = {
        transform: (record: any) => ({
          ...record,
          email: record.email.toLowerCase(),
        }),
        validate: (result: any) => result.email === result.email.toLowerCase(),
      }

      const operation = new TransformDataOperation('users', transformation)

      const result = operation.transformation.transform({ email: 'TEST@EXAMPLE.COM' })
      expect(operation.transformation.validate!(result)).toBe(true)
    })
  })
})
