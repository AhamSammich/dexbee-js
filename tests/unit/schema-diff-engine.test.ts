/* eslint-disable perfectionist/sort-imports */
import type { DatabaseSchema } from '../../src/types/schema.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { AddTableOperation } from '../../src/migration/operations/add-table-operation.js'
import { DropTableOperation } from '../../src/migration/operations/drop-table-operation.js'
import { AddFieldOperation } from '../../src/migration/operations/add-field-operation.js'
import { AlterFieldOperation } from '../../src/migration/operations/alter-field-operation.js'
import { TransformDataOperation } from '../../src/migration/operations/transform-data-operation.js'
import { AddIndexOperation } from '../../src/migration/operations/add-index-operation.js'
import { SchemaDiffEngine } from '../../src/core/schema-diff-engine.js'

describe('schemaDiffEngine', () => {
  let diffEngine: SchemaDiffEngine

  beforeEach(() => {
    diffEngine = new SchemaDiffEngine()
  })

  describe('generateDiff', () => {
    it('should detect added tables', () => {
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

    it('should detect added fields', () => {
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
              email: { type: 'string', required: false, unique: true },
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
      expect(diff.tablesModified[0].fieldsAdded).toHaveLength(1)
      expect(diff.tablesModified[0].fieldsAdded[0].fieldName).toBe('email')
    })

    it('should detect dropped fields', () => {
      const oldSchema: DatabaseSchema = {
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

      expect(diff.tablesModified).toHaveLength(1)
      expect(diff.tablesModified[0].fieldsDropped).toHaveLength(1)
      expect(diff.tablesModified[0].fieldsDropped[0]).toBe('email')
    })

    it('should detect modified fields', () => {
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
              name: { type: 'string', required: false }, // Changed from required to optional
            },
            primaryKey: 'id',
            autoIncrement: true,
          },
        },
      }

      const diff = diffEngine.generateDiff(oldSchema, newSchema)

      expect(diff.tablesModified).toHaveLength(1)
      expect(diff.tablesModified[0].fieldsModified).toHaveLength(1)
      expect(diff.tablesModified[0].fieldsModified[0].fieldName).toBe('name')
      expect(diff.tablesModified[0].fieldsModified[0].oldDefinition.required).toBe(true)
      expect(diff.tablesModified[0].fieldsModified[0].newDefinition.required).toBe(false)
    })

    it('should detect index changes', () => {
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
            indexes: [{ name: 'name_idx', keyPath: 'name' }],
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
            indexes: [{ name: 'name_idx', keyPath: 'name' }, { name: 'email_idx', keyPath: 'email' }],
          },
        },
      }

      const diff = diffEngine.generateDiff(oldSchema, newSchema)

      // Should only detect the new email_idx index, not name_idx which exists in both
      expect(diff.indexesAdded).toHaveLength(1)
      expect(diff.indexesAdded[0].indexName).toBe('email_idx')
      expect(diff.indexesDropped).toHaveLength(0)
    })

    it('should return empty diff when schemas are identical', () => {
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

      const diff = diffEngine.generateDiff(schema, schema)

      expect(diff.tablesAdded).toHaveLength(0)
      expect(diff.tablesDropped).toHaveLength(0)
      expect(diff.tablesModified).toHaveLength(0)
      expect(diff.indexesAdded).toHaveLength(0)
      expect(diff.indexesDropped).toHaveLength(0)
    })
  })

  describe('createMigrationOperations', () => {
    it('should create operations for added table', async () => {
      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {},
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
      const operations = await diffEngine.createMigrationOperations(diff)

      expect(operations).toHaveLength(1)
      expect(operations[0].type).toBe('addTable')
      expect(operations[0].tableName).toBe('users')
    })

    it('should create operations for dropped table', async () => {
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
        tables: {},
      }

      const diff = diffEngine.generateDiff(oldSchema, newSchema)
      const operations = await diffEngine.createMigrationOperations(diff)

      expect(operations).toHaveLength(1)
      expect(operations[0].type).toBe('dropTable')
      expect(operations[0].tableName).toBe('users')
    })

    it('should create operations for field changes', async () => {
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

      const diff = diffEngine.generateDiff(oldSchema, newSchema)
      const operations = await diffEngine.createMigrationOperations(diff)

      expect(operations).toHaveLength(1)
      expect(operations[0].type).toBe('addField')
      expect(operations[0].tableName).toBe('users')
    })

    it('should create operations in correct order', async () => {
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
      expect(operations[0].type).toBe('addTable') // Add tables first
      expect(operations[1].type).toBe('dropTable') // Drop tables last
    })
  })

  describe('validateMigrationSafety', () => {
    it('should validate safe operations', () => {
      const operations = [
        new AddTableOperation('users', {
          schema: { id: { type: 'number', required: true } },
          primaryKey: 'id',
          autoIncrement: true,
        }),
      ]

      const result = diffEngine.validateMigrationSafety(operations)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should warn about destructive operations', () => {
      const operations = [
        new DropTableOperation('users'),
      ]

      const result = diffEngine.validateMigrationSafety(operations)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('destructive operations')
    })

    it('should warn about data loss operations', () => {
      const operations = [
        new AlterFieldOperation('users', 'age', { type: 'string', required: true }, { type: 'number', required: true },
        ),
      ]

      const result = diffEngine.validateMigrationSafety(operations)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('data loss')
    })

    it('should detect invalid operation sequence', () => {
      const operations = [
        new DropTableOperation('users'),
        new AddFieldOperation('users', 'email', { type: 'string', required: false }),
      ]

      const result = diffEngine.validateMigrationSafety(operations)

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Cannot modify field in table')
    })

    it('should detect conflicting operations', () => {
      const operations = [
        new AddTableOperation('users', {
          schema: { id: { type: 'number', required: true } },
          primaryKey: 'id',
          autoIncrement: true,
        }),
        new DropTableOperation('users'),
      ]

      const result = diffEngine.validateMigrationSafety(operations)

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('both created and dropped')
    })
  })

  describe('estimateMigrationComplexity', () => {
    it('should estimate complexity for simple operations', () => {
      const operations = [
        new AddTableOperation('users', {
          schema: { id: { type: 'number', required: true } },
          primaryKey: 'id',
          autoIncrement: true,
        }),
      ]

      const report = diffEngine.estimateMigrationComplexity(operations)

      expect(report.score).toBeGreaterThan(0)
      expect(report.score).toBeLessThanOrEqual(10)
      expect(report.estimatedDuration).toBeGreaterThan(0)
      expect(['low', 'medium', 'high']).toContain(report.riskLevel)
      expect(report.factors).toContain('Table creation')
    })

    it('should estimate complexity for complex operations', () => {
      const operations = [
        new TransformDataOperation('users', { transform: (data: any) => data }),
      ]

      const report = diffEngine.estimateMigrationComplexity(operations)

      expect(report.score).toBeGreaterThan(5)
      expect(report.estimatedDuration).toBeGreaterThan(1000)
      expect(report.riskLevel).toBe('high')
      expect(report.factors).toContain('Data transformation (high complexity)')
    })

    it('should handle multiple operations', () => {
      const operations = [
        new AddTableOperation('users', {
          schema: { id: { type: 'number', required: true } },
          primaryKey: 'id',
          autoIncrement: true,
        }),
        new AddFieldOperation('users', 'name', { type: 'string', required: true }),
        new AddIndexOperation('users', 'name_idx', 'name', {}),
      ]

      const report = diffEngine.estimateMigrationComplexity(operations)

      expect(report.score).toBeGreaterThan(0)
      expect(report.factors.length).toBeGreaterThan(1)
      expect(report.factors).toContain('Table creation')
      expect(report.factors).toContain('Field addition')
      expect(report.factors).toContain('Index creation')
    })

    it('should normalize score to 1-10 range', () => {
      const operations = [
        new AddTableOperation('users', {
          schema: { id: { type: 'number', required: true } },
          primaryKey: 'id',
          autoIncrement: true,
        }),
      ]

      const report = diffEngine.estimateMigrationComplexity(operations)

      expect(report.score).toBeGreaterThanOrEqual(1)
      expect(report.score).toBeLessThanOrEqual(10)
    })
  })
})
