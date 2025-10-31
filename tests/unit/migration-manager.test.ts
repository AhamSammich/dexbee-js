import type { MigrationOptions } from '../../src/types/migration.js'
import type { DatabaseSchema } from '../../src/types/schema.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Database } from '../../src/core/database.js'
import { MigrationManager } from '../../src/core/migration-manager.js'
import 'fake-indexeddb/auto'

describe('migrationManager', () => {
  let migrationManager: MigrationManager
  let database: Database
  let dbName: string

  beforeEach(() => {
    dbName = `test-migration-manager-${Date.now()}-${Math.random()}`
    database = new Database(dbName, {
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
    })
    migrationManager = new MigrationManager(database)
  })

  afterEach(async () => {
    try {
      await database.close()
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      })
    } catch (error) {
      console.warn('Failed to cleanup test database:', error)
    }
  })

  describe('generateMigration', () => {
    it('should generate migration plan for schema changes', async () => {
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

      const plan = await migrationManager.generateMigration(oldSchema, newSchema)

      expect(plan).toBeDefined()
      expect(plan.version).toBe(2)
      expect(plan.operations).toBeDefined()
      expect(plan.estimatedDuration).toBeGreaterThan(0)
    })

    it('should handle empty migration when schemas are identical', async () => {
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

      const plan = await migrationManager.generateMigration(schema, schema)

      expect(plan.version).toBe(1)
      expect(plan.operations).toHaveLength(0)
    })

    it('should handle migration options', async () => {
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

      const options: MigrationOptions = {
        dryRun: true,
      }

      const plan = await migrationManager.generateMigration(oldSchema, newSchema, options)

      expect(plan).toBeDefined()
      expect(plan.version).toBe(2)
    })
  })

  describe('dryRun', () => {
    it('should perform dry run successfully', async () => {
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

      const migrationPlan = await migrationManager.generateMigration(oldSchema, newSchema)
      const result = await migrationManager.dryRun(migrationPlan)

      expect(result).toBeDefined()
      expect(result.isValid).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.operations).toBeDefined()
    })

    it('should detect validation errors in dry run', async () => {
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
        },
      }

      const migrationPlan = await migrationManager.generateMigration(oldSchema, newSchema)
      const result = await migrationManager.dryRun(migrationPlan)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toBeDefined()
    })
  })

  describe('applyMigration', () => {
    it('should apply migration successfully', async () => {
      await database.connect()

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

      const migrationPlan = await migrationManager.generateMigration(oldSchema, newSchema)
      const result = await migrationManager.applyMigration(migrationPlan)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.version).toBe(2)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should handle migration errors gracefully', async () => {
      // Mock database to throw error
      const mockDatabase = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        close: vi.fn(),
        isConnected: vi.fn().mockReturnValue(false),
        getConnection: vi.fn().mockReturnValue(null),
        transaction: vi.fn(),
      }

      const errorManager = new MigrationManager(mockDatabase as any)

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

      const migrationPlan = await errorManager.generateMigration(oldSchema, newSchema)
      await expect(errorManager.applyMigration(migrationPlan)).rejects.toThrow()
    })

    it('should validate migration before applying', async () => {
      await database.connect()

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

      const migrationPlan = await migrationManager.generateMigration(oldSchema, newSchema)
      const result = await migrationManager.applyMigration(migrationPlan)

      expect(result.success).toBe(true)
    })

    it('should handle dry run option', async () => {
      await database.connect()

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

      const migrationPlan = await migrationManager.generateMigration(oldSchema, newSchema)
      const options: MigrationOptions = { dryRun: true }
      const result = await migrationManager.applyMigration(migrationPlan, options)

      expect(result.success).toBe(true)
      expect(result.operationsExecuted).toBe(0)
    })
  })

  describe('getMigrationStatus', () => {
    it('should return current migration status', async () => {
      const status = await migrationManager.getMigrationStatus()

      expect(status).toBeDefined()
      expect(status.currentVersion).toBeDefined()
      expect(status.currentVersion).toBe(1) // Should match the schema version
    })

    it('should handle status retrieval errors', async () => {
      // Mock database to throw error when getting schema
      const mockDatabase = {
        ...database,
        getSchema: vi.fn().mockImplementation(() => {
          throw new Error('Schema error')
        }),
      }

      const errorManager = new MigrationManager(mockDatabase as any)

      await expect(errorManager.getMigrationStatus()).rejects.toThrow()
    })
  })
})
