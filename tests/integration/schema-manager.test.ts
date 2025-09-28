import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaManager } from '../../src/core/schema-manager.js';
import { DatabaseSchema, FieldType } from '../../src/types/schema.js';

describe('SchemaManager Integration Tests', () => {
  const validSchema: DatabaseSchema = {
    version: 1,
    tables: {
      users: {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
          email: { type: 'string', unique: true },
          age: { type: 'number', index: true },
          isActive: { type: 'boolean', default: () => true }
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'email_idx', keyPath: 'email', unique: true },
          { name: 'age_idx', keyPath: 'age' }
        ]
      },
      posts: {
        schema: {
          id: { type: 'number', required: true },
          title: { type: 'string', required: true },
          content: { type: 'string' },
          userId: { type: 'number', required: true },
          createdAt: { type: 'date', default: () => new Date() }
        },
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'userId_idx', keyPath: 'userId' }
        ]
      }
    }
  };

  let schemaManager: SchemaManager;

  beforeEach(() => {
    schemaManager = new SchemaManager(validSchema);
  });

  it('should validate a valid schema', () => {
    expect(() => schemaManager.validateSchema()).not.toThrow();
  });

  it('should reject schema with invalid field types', () => {
    const invalidSchema: DatabaseSchema = {
      version: 1,
      tables: {
        users: {
          schema: {
            id: { type: 'invalid' as FieldType, required: true }
          }
        }
      }
    };

    const invalidManager = new SchemaManager(invalidSchema);
    expect(() => invalidManager.validateSchema()).toThrow();
  });

  it('should reject schema with missing required fields in table config', () => {
    const invalidSchema: DatabaseSchema = {
      version: 1,
      tables: {
        users: {
          schema: {},
          primaryKey: 'nonexistent'
        }
      }
    };

    const invalidManager = new SchemaManager(invalidSchema);
    expect(() => invalidManager.validateSchema()).toThrow();
  });

  it('should apply schema during database upgrade', () => {
    const mockDb = {
      objectStoreNames: { contains: () => false },
      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn()
      }))
    } as any;

    expect(() => {
      schemaManager.applyMigrations(mockDb, 0, 1);
    }).not.toThrow();

    expect(mockDb.createObjectStore).toHaveBeenCalledTimes(2); // users and posts
  });

  it('should validate field values', () => {
    const userData = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      isActive: true
    };

    expect(() => {
      schemaManager.validateData('users', userData);
    }).not.toThrow();
  });

  it('should reject invalid field values', () => {
    const invalidUserData = {
      id: 'not-a-number', // Should be number
      name: 123, // Should be string
      email: 'john@example.com'
    };

    expect(() => {
      schemaManager.validateData('users', invalidUserData);
    }).toThrow();
  });

  it('should apply default values', () => {
    const userData = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
      // isActive missing - should get default
    };

    const processedData = schemaManager.applyDefaults('users', userData);

    expect(processedData.isActive).toBe(true);
  });
});