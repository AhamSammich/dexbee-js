import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TransactionManager } from '../../src/core/transaction-manager.js';
import { TransactionWrapper } from '../../src/core/transaction-wrapper.js';
import { DatabaseManager } from '../../src/core/database-manager.js';
import { DatabaseSchema } from '../../src/types/schema.js';

describe('TransactionManager Integration Tests', () => {
  const testSchema: DatabaseSchema = {
    version: 1,
    tables: {
      users: {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
          email: { type: 'string', unique: true }
        },
        primaryKey: 'id',
        autoIncrement: true
      },
      posts: {
        schema: {
          id: { type: 'number', required: true },
          title: { type: 'string', required: true },
          userId: { type: 'number', required: true }
        },
        primaryKey: 'id',
        autoIncrement: true
      }
    }
  };

  let dbManager: DatabaseManager;
  let transactionManager: TransactionManager;
  let db: IDBDatabase;

  beforeEach(async () => {
    dbManager = new DatabaseManager('test-transaction-db', 1, testSchema);
    db = await dbManager.connect();
    transactionManager = new TransactionManager(db);
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should create and manage transactions', async () => {
    const result = await transactionManager.withTransaction(
      { stores: ['users'], mode: 'readwrite' },
      async (tx) => {
        expect(tx).toBeInstanceOf(TransactionWrapper);
        expect(tx.getMode()).toBe('readwrite');
        return 'success';
      }
    );

    expect(result).toBe('success');
  });

  it('should provide read-only transaction helper', async () => {
    const result = await transactionManager.withReadTransaction(
      ['users'],
      async (tx) => {
        expect(tx.getMode()).toBe('readonly');
        const store = tx.getStore('users');
        expect(store).toBeDefined();
        return 'read-success';
      }
    );

    expect(result).toBe('read-success');
  });

  it('should provide read-write transaction helper', async () => {
    const result = await transactionManager.withWriteTransaction(
      ['users'],
      async (tx) => {
        expect(tx.getMode()).toBe('readwrite');
        const store = tx.getStore('users');
        expect(store).toBeDefined();
        return 'write-success';
      }
    );

    expect(result).toBe('write-success');
  });

  it('should handle transaction errors', async () => {
    await expect(
      transactionManager.withTransaction(
        { stores: ['users'], mode: 'readwrite' },
        async (tx) => {
          throw new Error('Test error');
        }
      )
    ).rejects.toThrow('Test error');
  });

  it('should track active transaction count', async () => {
    expect(transactionManager.getActiveTransactionCount()).toBe(0);

    const promise = transactionManager.withTransaction(
      { stores: ['users'], mode: 'readonly' },
      async (tx) => {
        expect(transactionManager.getActiveTransactionCount()).toBe(1);
        return 'done';
      }
    );

    await promise;
    expect(transactionManager.getActiveTransactionCount()).toBe(0);
  });

  it('should support multi-store transactions', async () => {
    const result = await transactionManager.withTransaction(
      { stores: ['users', 'posts'], mode: 'readwrite' },
      async (tx) => {
        const usersStore = tx.getStore('users');
        const postsStore = tx.getStore('posts');

        expect(usersStore).toBeDefined();
        expect(postsStore).toBeDefined();

        return 'multi-store-success';
      }
    );

    expect(result).toBe('multi-store-success');
  });
});

describe('TransactionWrapper Integration Tests', () => {
  const testSchema: DatabaseSchema = {
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

  let dbManager: DatabaseManager;
  let db: IDBDatabase;

  beforeEach(async () => {
    dbManager = new DatabaseManager('test-wrapper-db', 1, testSchema);
    db = await dbManager.connect();
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should create transaction wrapper correctly', async () => {
    const wrapper = await TransactionWrapper.create(db, {
      stores: ['users'],
      mode: 'readwrite'
    });

    expect(wrapper.getMode()).toBe('readwrite');
    expect(wrapper.isCompleted()).toBe(false);

    const store = wrapper.getStore('users');
    expect(store).toBeDefined();

    await wrapper.commit();
    expect(wrapper.isCompleted()).toBe(true);
  });

  it('should handle transaction abortion', async () => {
    const wrapper = await TransactionWrapper.create(db, {
      stores: ['users'],
      mode: 'readwrite'
    });

    expect(wrapper.isCompleted()).toBe(false);
    await wrapper.abort();
    expect(wrapper.isCompleted()).toBe(true);
  });

  it('should throw error for invalid store access', async () => {
    const wrapper = await TransactionWrapper.create(db, {
      stores: ['users'],
      mode: 'readonly'
    });

    expect(() => wrapper.getStore('nonexistent')).toThrow();
  });
});