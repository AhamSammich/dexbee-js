import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/core/database.js';
import { DatabaseSchema } from '../../src/types/schema.js';

describe('Database Integration Tests', () => {
  const testSchema: DatabaseSchema = {
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

  let database: Database;

  beforeEach(() => {
    database = new Database('test-main-db', testSchema);
  });

  afterEach(() => {
    if (database.isConnected()) {
      database.close();
    }
  });

  it('should create database instance', () => {
    expect(database).toBeDefined();
    expect(database.isConnected()).toBe(false);
  });

  it('should connect to database', async () => {
    await database.connect();

    expect(database.isConnected()).toBe(true);
  });

  it('should validate schema during initialization', () => {
    const invalidSchema: DatabaseSchema = {
      version: -1, // Invalid version
      tables: {}
    };

    expect(() => {
      new Database('test-invalid-db', invalidSchema);
    }).toThrow();
  });

  it('should create transactions', async () => {
    await database.connect();

    const tx = await database.transaction({
      stores: ['users'],
      mode: 'readonly'
    });

    expect(tx).toBeDefined();
    expect(tx.getMode()).toBe('readonly');

    const store = tx.getStore('users');
    expect(store).toBeDefined();
  });

  it('should handle database operations with data validation', async () => {
    await database.connect();

    // Valid user data
    const validUser = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    };

    expect(() => {
      database.validateData('users', validUser);
    }).not.toThrow();

    // Invalid user data
    const invalidUser = {
      name: 123, // Should be string
      email: 'john@example.com'
    };

    expect(() => {
      database.validateData('users', invalidUser);
    }).toThrow();
  });

  it('should apply default values', async () => {
    await database.connect();

    const userData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      age: 25
      // isActive missing - should get default
    };

    const processedData = database.applyDefaults('users', userData);
    expect(processedData.isActive).toBe(true);
  });

  it('should handle connection lifecycle', async () => {
    expect(database.isConnected()).toBe(false);

    await database.connect();
    expect(database.isConnected()).toBe(true);

    database.close();
    expect(database.isConnected()).toBe(false);
  });

  it('should perform complete CRUD workflow', async () => {
    await database.connect();

    // Create a user within a transaction
    await database.withWriteTransaction(['users'], async (tx) => {
      const store = tx.getStore('users');

      const userData = database.applyDefaults('users', {
        name: 'Test User',
        email: 'test@example.com',
        age: 25
      });

      database.validateData('users', userData);

      // Add the user to the store
      const request = store.add(userData);

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    // Read the user back
    const result = await database.withReadTransaction(['users'], async (tx) => {
      const store = tx.getStore('users');
      const request = store.getAll();

      return new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Test User');
    expect(result[0].isActive).toBe(true); // Default value applied
  });
});