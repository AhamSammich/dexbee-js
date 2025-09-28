import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { DexBee, eq, gt, lt, and, or, not, DatabaseSchema } from '../../src/index.js';

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  createdAt: Date;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  content: string;
  published: boolean;
}

const testSchema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true, unique: true },
        age: { type: 'number', required: true, index: true },
        isActive: { type: 'boolean', default: () => true },
        createdAt: { type: 'date', default: () => new Date() }
      },
      primaryKey: 'id',
      autoIncrement: true
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        userId: { type: 'number', required: true, index: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        published: { type: 'boolean', default: () => false }
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
};

describe('Query Builder Integration Tests', () => {
  let db: any;

  beforeEach(async () => {
    // Create a fresh database for each test
    const dbName = `test-db-${Date.now()}-${Math.random()}`;
    db = await DexBee.connect(dbName, testSchema);

    // Insert test data
    const users = db.table<User>('users');
    await users.insertMany([
      { name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
      { name: 'Bob', email: 'bob@example.com', age: 35, isActive: true },
      { name: 'Charlie', email: 'charlie@example.com', age: 17, isActive: false },
      { name: 'Diana', email: 'diana@example.com', age: 42, isActive: true },
      { name: 'Eve', email: 'eve@example.com', age: 28, isActive: false }
    ]);

    const posts = db.table<Post>('posts');
    await posts.insertMany([
      { userId: 1, title: 'Hello World', content: 'First post', published: true },
      { userId: 1, title: 'Second Post', content: 'Another post', published: false },
      { userId: 2, title: 'Bob\'s Post', content: 'Bob\'s content', published: true },
      { userId: 4, title: 'Diana\'s Post', content: 'Diana\'s content', published: true }
    ]);
  });

  describe('Basic Query Operations', () => {
    it('should fetch all records without conditions', async () => {
      const users = db.table<User>('users');
      const results = await users.all();

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('email');
    });

    it('should count all records', async () => {
      const users = db.table<User>('users');
      const count = await users.count();

      expect(count).toBe(5);
    });

    it('should fetch first record', async () => {
      const users = db.table<User>('users');
      const first = await users.first();

      expect(first).not.toBeNull();
      expect(first).toHaveProperty('name');
    });
  });

  describe('Field Selection', () => {
    it('should select specific fields', async () => {
      const users = db.table<User>('users');
      const results = await users.select('name', 'email').all();

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('email');
      expect(results[0]).not.toHaveProperty('age');
      expect(results[0]).not.toHaveProperty('isActive');
    });

    it('should select single field', async () => {
      const users = db.table<User>('users');
      const results = await users.select('name').all();

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).not.toHaveProperty('email');
      expect(Object.keys(results[0])).toHaveLength(1);
    });
  });

  describe('Where Conditions - Comparison Operators', () => {
    it('should filter with eq condition', async () => {
      const users = db.table<User>('users');
      const results = await users.where(eq('name', 'Alice')).all();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice');
      expect(results[0].email).toBe('alice@example.com');
    });

    it('should filter with gt condition', async () => {
      const users = db.table<User>('users');
      const results = await users.where(gt('age', 30)).all();

      expect(results).toHaveLength(2); // Bob (35) and Diana (42)
      expect(results.every(user => user.age > 30)).toBe(true);
    });

    it('should filter with lt condition', async () => {
      const users = db.table<User>('users');
      const results = await users.where(lt('age', 25)).all();

      expect(results).toHaveLength(1); // Charlie (17)
      expect(results[0].name).toBe('Charlie');
      expect(results[0].age).toBe(17);
    });

    it('should handle no matches', async () => {
      const users = db.table<User>('users');
      const results = await users.where(eq('name', 'NonExistent')).all();

      expect(results).toHaveLength(0);
    });
  });

  describe('Logical Operators', () => {
    it('should combine conditions with AND', async () => {
      const users = db.table<User>('users');
      const results = await users
        .where(and(
          gt('age', 20),
          eq('isActive', true)
        ))
        .all();

      expect(results).toHaveLength(3); // Alice, Bob, Diana
      expect(results.every(user => user.age > 20 && user.isActive)).toBe(true);
    });

    it('should combine conditions with OR', async () => {
      const users = db.table<User>('users');
      const results = await users
        .where(or(
          eq('name', 'Alice'),
          eq('name', 'Bob')
        ))
        .all();

      expect(results).toHaveLength(2);
      expect(results.map(u => u.name).sort()).toEqual(['Alice', 'Bob']);
    });

    it('should negate conditions with NOT', async () => {
      const users = db.table<User>('users');
      const results = await users
        .where(not(eq('isActive', true)))
        .all();

      expect(results).toHaveLength(2); // Charlie and Eve
      expect(results.every(user => !user.isActive)).toBe(true);
    });

    it('should handle complex nested conditions', async () => {
      const users = db.table<User>('users');
      const results = await users
        .where(and(
          or(
            eq('name', 'Alice'),
            eq('name', 'Bob')
          ),
          eq('isActive', true)
        ))
        .all();

      expect(results).toHaveLength(2); // Alice and Bob (both active)
      expect(results.every(user => user.isActive)).toBe(true);
    });
  });

  describe('Ordering and Pagination', () => {
    it('should order by field ascending', async () => {
      const users = db.table<User>('users');
      const results = await users.orderBy('age', 'asc').all();

      expect(results).toHaveLength(5);
      expect(results[0].age).toBe(17); // Charlie
      expect(results[4].age).toBe(42); // Diana

      // Verify ordering
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age).toBeGreaterThanOrEqual(results[i - 1].age);
      }
    });

    it('should order by field descending', async () => {
      const users = db.table<User>('users');
      const results = await users.orderBy('age', 'desc').all();

      expect(results).toHaveLength(5);
      expect(results[0].age).toBe(42); // Diana
      expect(results[4].age).toBe(17); // Charlie

      // Verify ordering
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age).toBeLessThanOrEqual(results[i - 1].age);
      }
    });

    it('should limit results', async () => {
      const users = db.table<User>('users');
      const results = await users.limit(3).all();

      expect(results).toHaveLength(3);
    });

    it('should offset results', async () => {
      const users = db.table<User>('users');
      const all = await users.orderBy('name').all();
      const offset = await users.orderBy('name').offset(2).all();

      expect(offset).toHaveLength(3); // 5 total - 2 offset = 3
      expect(offset[0].name).toBe(all[2].name);
    });

    it('should combine limit and offset', async () => {
      const users = db.table<User>('users');
      const results = await users
        .orderBy('age')
        .offset(1)
        .limit(2)
        .all();

      expect(results).toHaveLength(2);
    });
  });

  describe('Complex Queries', () => {
    it('should combine multiple query operations', async () => {
      const users = db.table<User>('users');
      const results = await users
        .select('name', 'age')
        .where(and(
          gt('age', 20),
          eq('isActive', true)
        ))
        .orderBy('age', 'desc')
        .limit(2)
        .all();

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('age');
      expect(results[0]).not.toHaveProperty('email');
      expect(results[0].age).toBeGreaterThan(results[1].age); // Descending order
    });

    it('should work with first() on complex query', async () => {
      const users = db.table<User>('users');
      const result = await users
        .where(eq('isActive', true))
        .orderBy('age', 'desc')
        .first();

      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(true);
      expect(result!.age).toBe(42); // Diana, oldest active user
    });

    it('should count with conditions', async () => {
      const users = db.table<User>('users');
      const count = await users
        .where(eq('isActive', true))
        .count();

      expect(count).toBe(3); // Alice, Bob, Diana
    });
  });

  describe('Multi-table Operations', () => {
    it('should query different tables independently', async () => {
      const users = db.table<User>('users');
      const posts = db.table<Post>('posts');

      const userCount = await users.count();
      const postCount = await posts.count();

      expect(userCount).toBe(5);
      expect(postCount).toBe(4);
    });

    it('should filter posts by userId', async () => {
      const posts = db.table<Post>('posts');
      const userPosts = await posts.where(eq('userId', 1)).all();

      expect(userPosts).toHaveLength(2);
      expect(userPosts.every(post => post.userId === 1)).toBe(true);
    });

    it('should find published posts', async () => {
      const posts = db.table<Post>('posts');
      const published = await posts.where(eq('published', true)).all();

      expect(published).toHaveLength(3);
      expect(published.every(post => post.published)).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    it('should insert single record', async () => {
      const users = db.table<User>('users');
      const newUser = await users.insert({
        name: 'Frank',
        email: 'frank@example.com',
        age: 30
      });

      expect(newUser).toHaveProperty('id');
      expect(newUser.name).toBe('Frank');
      expect(newUser.isActive).toBe(true); // Default value
    });

    it('should find record by ID', async () => {
      const users = db.table<User>('users');
      const user = await users.findById(1);

      expect(user).not.toBeNull();
      expect(user!.name).toBe('Alice');
    });

    it('should update record', async () => {
      const users = db.table<User>('users');
      const updated = await users.update(1, { age: 26 });

      expect(updated.age).toBe(26);
      expect(updated.name).toBe('Alice'); // Other fields unchanged
    });

    it('should delete record', async () => {
      const users = db.table<User>('users');
      const deleted = await users.delete(1);

      expect(deleted).toBe(true);

      const user = await users.findById(1);
      expect(user).toBeNull();
    });
  });
});