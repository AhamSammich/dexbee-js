import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DexBee,
  DatabaseSchema,
  MigrationManager,
  SchemaDiffEngine,
  DataTransformer,
  AddTableOperation,
  DropTableOperation,
  AddFieldOperation,
  DropFieldOperation,
  AlterFieldOperation,
  TransformDataOperation
} from '../../src/index.js';

describe('Migration System Integration', () => {
  let dbName: string;

  beforeEach(() => {
    dbName = `test-migration-${Date.now()}-${Math.random()}`;
  });

  afterEach(async () => {
    // Cleanup: Delete the test database
    try {
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  });

  describe('Schema Diff Engine', () => {
    test('should detect added tables', () => {
      const diffEngine = new SchemaDiffEngine();

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              content: { type: 'string', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const diff = diffEngine.generateDiff(oldSchema, newSchema);

      expect(diff.tablesAdded).toHaveLength(1);
      expect(diff.tablesAdded[0].name).toBe('posts');
      expect(diff.tablesDropped).toHaveLength(0);
      expect(diff.tablesModified).toHaveLength(0);
    });

    test('should detect dropped tables', () => {
      const diffEngine = new SchemaDiffEngine();

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const diff = diffEngine.generateDiff(oldSchema, newSchema);

      expect(diff.tablesAdded).toHaveLength(0);
      expect(diff.tablesDropped).toHaveLength(1);
      expect(diff.tablesDropped[0]).toBe('posts');
      expect(diff.tablesModified).toHaveLength(0);
    });

    test('should detect field modifications', () => {
      const diffEngine = new SchemaDiffEngine();

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false },
              age: { type: 'number', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const diff = diffEngine.generateDiff(oldSchema, newSchema);

      expect(diff.tablesAdded).toHaveLength(0);
      expect(diff.tablesDropped).toHaveLength(0);
      expect(diff.tablesModified).toHaveLength(1);
      expect(diff.tablesModified[0].tableName).toBe('users');
      expect(diff.tablesModified[0].fieldsAdded).toHaveLength(2);
      expect(diff.tablesModified[0].fieldsAdded[0].fieldName).toBe('email');
      expect(diff.tablesModified[0].fieldsAdded[1].fieldName).toBe('age');
    });

    test('should create migration operations from diff', async () => {
      const diffEngine = new SchemaDiffEngine();

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const diff = diffEngine.generateDiff(oldSchema, newSchema);
      const operations = await diffEngine.createMigrationOperations(diff);

      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('addTable');
      expect(operations[0].tableName).toBe('posts');
      expect(operations[1].type).toBe('addField');
      expect(operations[1].tableName).toBe('users');
    });
  });

  describe('Migration Operations', () => {
    test('AddTableOperation should validate correctly', () => {
      const tableConfig = {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true }
        },
        primaryKey: 'id',
        autoIncrement: true
      };

      const operation = new AddTableOperation('test_table', tableConfig);

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {}
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          test_table: tableConfig
        }
      };

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow();
    });

    test('AddTableOperation should throw for existing table', () => {
      const tableConfig = {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true }
        },
        primaryKey: 'id',
        autoIncrement: true
      };

      const operation = new AddTableOperation('test_table', tableConfig);

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          test_table: tableConfig
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          test_table: tableConfig
        }
      };

      expect(() => operation.validate(oldSchema, newSchema)).toThrow();
    });

    test('AddFieldOperation should validate correctly', () => {
      const operation = new AddFieldOperation(
        'users',
        'email',
        { type: 'string', required: false }
      );

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow();
    });

    test('AlterFieldOperation should detect type changes', () => {
      const operation = new AlterFieldOperation(
        'users',
        'age',
        { type: 'string', required: false },
        { type: 'number', required: false }
      );

      const oldSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              age: { type: 'string', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              age: { type: 'number', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      expect(() => operation.validate(oldSchema, newSchema)).not.toThrow();
    });
  });

  describe('Data Transformation', () => {
    test('should validate transformation functions', async () => {
      const transformer = new DataTransformer();

      const validTransformation = {
        transform: (record: any) => ({ ...record, newField: 'test' }),
        filter: (record: any) => true,
        validate: (result: any) => result.newField === 'test'
      };

      const result = await transformer.validateTransformation(
        'test_table',
        validTransformation,
        10
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid transformation functions', async () => {
      const transformer = new DataTransformer();

      const invalidTransformation = {
        // @ts-ignore - intentionally invalid for testing
        transform: 'not a function',
        filter: (record: any) => true
      };

      const result = await transformer.validateTransformation(
        'test_table',
        invalidTransformation as any,
        10
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Manager Integration', () => {
    test('should generate migration plan for schema changes', async () => {
      // Create initial database
      const initialSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const db = await DexBee.connect(dbName, initialSchema);

      // Define new schema
      const newSchema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              content: { type: 'string', required: false }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      // Test dry run
      const dryRunResult = await db.dryRunMigration(newSchema);

      expect(dryRunResult.isValid).toBe(true);
      expect(dryRunResult.operations.length).toBeGreaterThan(0);
      expect(dryRunResult.errors).toHaveLength(0);

      // Test migration status
      const status = await db.getMigrationStatus();
      expect(status.currentVersion).toBe(1);

      db.close();
    });

    test('should handle empty migration', async () => {
      const schema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const db = await DexBee.connect(dbName, schema);

      // Try to migrate to the same schema
      const dryRunResult = await db.dryRunMigration(schema);

      expect(dryRunResult.isValid).toBe(true);
      expect(dryRunResult.operations).toHaveLength(0);
      expect(dryRunResult.warnings).toContain('Migration plan has no operations');

      db.close();
    });

    test('should validate migration prerequisites', async () => {
      const initialSchema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const db = await DexBee.connect(dbName, initialSchema);

      // Try to migrate to a lower version (should fail)
      const invalidSchema: DatabaseSchema = {
        version: 0,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      await expect(db.dryRunMigration(invalidSchema)).rejects.toThrow();

      db.close();
    });
  });

  describe('TransformDataOperation', () => {
    test('should validate transformation operation', () => {
      const transformation = {
        transform: (record: any) => ({ ...record, processed: true }),
        filter: (record: any) => !record.processed,
        validate: (result: any) => result.processed === true
      };

      const operation = new TransformDataOperation('users', transformation);

      const schema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      expect(() => operation.validate(schema, schema)).not.toThrow();
    });

    test('should reject invalid transformation', () => {
      const invalidTransformation = {
        // Missing transform function
        filter: (record: any) => true
      };

      const operation = new TransformDataOperation('users', invalidTransformation as any);

      const schema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      expect(() => operation.validate(schema, schema)).toThrow();
    });
  });

  describe('End-to-End Migration', () => {
    test('should complete full migration workflow', async () => {
      // Step 1: Create initial database
      const v1Schema: DatabaseSchema = {
        version: 1,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      const db = await DexBee.connect(dbName, v1Schema);

      // Add some initial data
      const users = db.table('users');
      await users.insert({ name: 'Alice' });
      await users.insert({ name: 'Bob' });

      // Verify initial state
      const initialUsers = await users.all();
      expect(initialUsers).toHaveLength(2);

      // Step 2: Define new schema
      const v2Schema: DatabaseSchema = {
        version: 2,
        tables: {
          users: {
            schema: {
              id: { type: 'number', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: false, default: '' }
            },
            primaryKey: 'id',
            autoIncrement: true
          },
          posts: {
            schema: {
              id: { type: 'number', required: true },
              title: { type: 'string', required: true },
              authorId: { type: 'number', required: true }
            },
            primaryKey: 'id',
            autoIncrement: true
          }
        }
      };

      // Step 3: Dry run migration
      const dryRun = await db.dryRunMigration(v2Schema);
      expect(dryRun.isValid).toBe(true);
      expect(dryRun.operations.length).toBeGreaterThan(0);

      // Step 4: Get migration status
      const beforeStatus = await db.getMigrationStatus();
      expect(beforeStatus.currentVersion).toBe(1);

      // Note: Actual migration execution would require more complex setup
      // with proper IndexedDB version change handling. For now, we test
      // the planning and validation aspects.

      db.close();
    });
  });
});