import { describe, expect, test, beforeEach } from 'vitest';
import { DexBee } from '../../src/index.js';
import { DatabaseSchema } from '../../src/types/schema.js';
import { eq, gt } from '../../src/query/operators.js';

// Test schema with relationships
const relationshipSchema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', unique: true },
        age: { type: 'number' }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'email_idx', keyPath: 'email', unique: true }
      ],
      relationships: {
        posts: {
          type: 'hasMany',
          table: 'posts',
          foreignKey: 'userId'
        },
        profile: {
          type: 'hasOne',
          table: 'profiles',
          foreignKey: 'userId'
        },
        tags: {
          type: 'belongsToMany',
          table: 'tags',
          through: 'user_tags',
          throughLocalKey: 'userId',
          throughForeignKey: 'tagId'
        }
      }
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string' },
        userId: { type: 'number', required: true },
        published: { type: 'boolean', default: () => false }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'userId_idx', keyPath: 'userId' }
      ],
      relationships: {
        author: {
          type: 'belongsTo',
          table: 'users',
          localKey: 'userId',
          foreignKey: 'id'
        }
      }
    },
    profiles: {
      schema: {
        id: { type: 'number', required: true },
        userId: { type: 'number', required: true },
        bio: { type: 'string' },
        website: { type: 'string' }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'userId_idx', keyPath: 'userId' }
      ],
      relationships: {
        user: {
          type: 'belongsTo',
          table: 'users',
          localKey: 'userId',
          foreignKey: 'id'
        }
      }
    },
    tags: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        color: { type: 'string' }
      },
      primaryKey: 'id',
      autoIncrement: true,
      relationships: {
        users: {
          type: 'belongsToMany',
          table: 'users',
          through: 'user_tags',
          throughLocalKey: 'tagId',
          throughForeignKey: 'userId'
        }
      }
    },
    user_tags: {
      schema: {
        id: { type: 'number', required: true },
        userId: { type: 'number', required: true },
        tagId: { type: 'number', required: true }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'userId_idx', keyPath: 'userId' },
        { name: 'tagId_idx', keyPath: 'tagId' }
      ]
    }
  }
};

// Type definitions for test data
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  posts?: Post[];
  profile?: Profile;
  tags?: Tag[];
}

interface Post {
  id: number;
  title: string;
  content: string;
  userId: number;
  published: boolean;
  author?: User;
}

interface Profile {
  id: number;
  userId: number;
  bio: string;
  website: string;
  user?: User;
}

interface Tag {
  id: number;
  name: string;
  color: string;
  users?: User[];
}

interface UserTag {
  id: number;
  userId: number;
  tagId: number;
}

describe('Relationships', () => {
  let db: Awaited<ReturnType<typeof DexBee.connect>>;

  beforeEach(async () => {
    // Create and connect to database
    db = await DexBee.connect('test-relationships-db', relationshipSchema);

    // Set up test data
    await setupTestData();
  });

  async function setupTestData() {
    const users = db.table<User>('users');
    const posts = db.table<Post>('posts');
    const profiles = db.table<Profile>('profiles');
    const tags = db.table<Tag>('tags');
    const userTags = db.table<UserTag>('user_tags');

    // Create users
    const alice = await users.insert({ name: 'Alice', email: 'alice@example.com', age: 30 });
    const bob = await users.insert({ name: 'Bob', email: 'bob@example.com', age: 25 });
    const charlie = await users.insert({ name: 'Charlie', email: 'charlie@example.com', age: 35 });

    // Create posts
    await posts.insertMany([
      { title: 'Alice Post 1', content: 'Content 1', userId: alice.id, published: true },
      { title: 'Alice Post 2', content: 'Content 2', userId: alice.id, published: false },
      { title: 'Bob Post 1', content: 'Bob Content 1', userId: bob.id, published: true },
      { title: 'Charlie Post 1', content: 'Charlie Content 1', userId: charlie.id, published: true }
    ]);

    // Create profiles
    await profiles.insertMany([
      { userId: alice.id, bio: 'Alice bio', website: 'alice.com' },
      { userId: bob.id, bio: 'Bob bio', website: 'bob.com' }
      // Charlie has no profile
    ]);

    // Create tags
    const jsTag = await tags.insert({ name: 'JavaScript', color: 'yellow' });
    const tsTag = await tags.insert({ name: 'TypeScript', color: 'blue' });
    const reactTag = await tags.insert({ name: 'React', color: 'cyan' });

    // Create many-to-many relationships
    await userTags.insertMany([
      { userId: alice.id, tagId: jsTag.id },
      { userId: alice.id, tagId: tsTag.id },
      { userId: bob.id, tagId: jsTag.id },
      { userId: bob.id, tagId: reactTag.id },
      { userId: charlie.id, tagId: tsTag.id }
    ]);
  }

  describe('hasMany Relationships', () => {
    test('should load posts for users', async () => {
      const users = db.table<User>('users');

      const usersWithPosts = await users
        .include('posts')
        .orderBy('name')
        .all();

      expect(usersWithPosts).toHaveLength(3);

      const alice = usersWithPosts.find(u => u.name === 'Alice');
      const bob = usersWithPosts.find(u => u.name === 'Bob');
      const charlie = usersWithPosts.find(u => u.name === 'Charlie');

      expect(alice?.posts).toHaveLength(2);
      expect(bob?.posts).toHaveLength(1);
      expect(charlie?.posts).toHaveLength(1);

      expect(alice?.posts?.[0]).toHaveProperty('title');
      expect(alice?.posts?.[0]).toHaveProperty('userId', alice.id);
    });

    test('should filter related posts', async () => {
      const users = db.table<User>('users');

      const usersWithPublishedPosts = await users
        .include('posts', {
          where: eq('published', true)
        })
        .where(eq('name', 'Alice'))
        .all();

      const alice = usersWithPublishedPosts[0];
      expect(alice.posts).toHaveLength(1);
      expect(alice.posts?.[0].published).toBe(true);
    });

    test('should select specific fields from related posts', async () => {
      const users = db.table<User>('users');

      const usersWithPostTitles = await users
        .include('posts', {
          select: ['title', 'published']
        })
        .where(eq('name', 'Alice'))
        .all();

      const alice = usersWithPostTitles[0];
      expect(alice.posts).toHaveLength(2);

      const post = alice.posts?.[0];
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('published');
      expect(post).not.toHaveProperty('content');
      expect(post).not.toHaveProperty('userId');
    });

    test('should limit related posts', async () => {
      const users = db.table<User>('users');

      const usersWithLimitedPosts = await users
        .include('posts', {
          limit: 1
        })
        .where(eq('name', 'Alice'))
        .all();

      const alice = usersWithLimitedPosts[0];
      expect(alice.posts).toHaveLength(1);
    });
  });

  describe('hasOne Relationships', () => {
    test('should load profile for users', async () => {
      const users = db.table<User>('users');

      const usersWithProfiles = await users
        .include('profile')
        .orderBy('name')
        .all();

      const alice = usersWithProfiles.find(u => u.name === 'Alice');
      const bob = usersWithProfiles.find(u => u.name === 'Bob');
      const charlie = usersWithProfiles.find(u => u.name === 'Charlie');

      expect(alice?.profile).toBeDefined();
      expect(alice?.profile?.bio).toBe('Alice bio');
      expect(alice?.profile?.userId).toBe(alice.id);

      expect(bob?.profile).toBeDefined();
      expect(bob?.profile?.bio).toBe('Bob bio');

      expect(charlie?.profile).toBeNull(); // Charlie has no profile
    });

    test('should select specific fields from profile', async () => {
      const users = db.table<User>('users');

      const usersWithProfileBio = await users
        .include('profile', {
          select: ['bio']
        })
        .where(eq('name', 'Alice'))
        .all();

      const alice = usersWithProfileBio[0];
      expect(alice.profile).toBeDefined();
      expect(alice.profile).toHaveProperty('bio');
      expect(alice.profile).not.toHaveProperty('website');
      expect(alice.profile).not.toHaveProperty('userId');
    });
  });

  describe('belongsTo Relationships', () => {
    test('should load author for posts', async () => {
      const posts = db.table<Post>('posts');

      const postsWithAuthors = await posts
        .include('author')
        .orderBy('title')
        .all();

      expect(postsWithAuthors).toHaveLength(4);

      const alicePost = postsWithAuthors.find(p => p.title === 'Alice Post 1');
      expect(alicePost?.author).toBeDefined();
      expect(alicePost?.author?.name).toBe('Alice');
      expect(alicePost?.author?.id).toBe(alicePost.userId);
    });

    test('should load user for profiles', async () => {
      const profiles = db.table<Profile>('profiles');

      const profilesWithUsers = await profiles
        .include('user')
        .all();

      expect(profilesWithUsers).toHaveLength(2);

      const aliceProfile = profilesWithUsers.find(p => p.bio === 'Alice bio');
      expect(aliceProfile?.user).toBeDefined();
      expect(aliceProfile?.user?.name).toBe('Alice');
      expect(aliceProfile?.user?.id).toBe(aliceProfile.userId);
    });
  });

  describe('belongsToMany Relationships', () => {
    test('should load tags for users', async () => {
      const users = db.table<User>('users');

      const usersWithTags = await users
        .include('tags')
        .orderBy('name')
        .all();

      const alice = usersWithTags.find(u => u.name === 'Alice');
      const bob = usersWithTags.find(u => u.name === 'Bob');
      const charlie = usersWithTags.find(u => u.name === 'Charlie');

      expect(alice?.tags).toHaveLength(2);
      expect(bob?.tags).toHaveLength(2);
      expect(charlie?.tags).toHaveLength(1);

      const aliceTagNames = alice?.tags?.map(t => t.name).sort();
      expect(aliceTagNames).toEqual(['JavaScript', 'TypeScript']);

      const bobTagNames = bob?.tags?.map(t => t.name).sort();
      expect(bobTagNames).toEqual(['JavaScript', 'React']);
    });

    test('should load users for tags', async () => {
      const tags = db.table<Tag>('tags');

      const tagsWithUsers = await tags
        .include('users')
        .orderBy('name')
        .all();

      const jsTag = tagsWithUsers.find(t => t.name === 'JavaScript');
      const tsTag = tagsWithUsers.find(t => t.name === 'TypeScript');
      const reactTag = tagsWithUsers.find(t => t.name === 'React');

      expect(jsTag?.users).toHaveLength(2);
      expect(tsTag?.users).toHaveLength(2);
      expect(reactTag?.users).toHaveLength(1);

      const jsUserNames = jsTag?.users?.map(u => u.name).sort();
      expect(jsUserNames).toEqual(['Alice', 'Bob']);
    });
  });

  describe('Multiple Relationships', () => {
    test('should load multiple relationships at once', async () => {
      const users = db.table<User>('users');

      const usersWithAll = await users
        .include('posts')
        .include('profile')
        .include('tags')
        .where(eq('name', 'Alice'))
        .all();

      const alice = usersWithAll[0];

      expect(alice.posts).toHaveLength(2);
      expect(alice.profile).toBeDefined();
      expect(alice.profile?.bio).toBe('Alice bio');
      expect(alice.tags).toHaveLength(2);
    });

    test('should work with complex queries', async () => {
      const users = db.table<User>('users');

      const adultsWithPublishedPosts = await users
        .where(gt('age', 25))
        .include('posts', {
          where: eq('published', true),
          select: ['title']
        })
        .include('profile', {
          select: ['bio']
        })
        .orderBy('age')
        .all();

      expect(adultsWithPublishedPosts).toHaveLength(2); // Alice and Charlie

      for (const user of adultsWithPublishedPosts) {
        expect(user.age).toBeGreaterThan(25);

        if (user.posts && user.posts.length > 0) {
          for (const post of user.posts) {
            // Since we filtered by published: true, all posts should be published
            // But we only selected 'title', so 'published' field won't be present
            expect(post).toHaveProperty('title');
            expect(post).not.toHaveProperty('content');
            expect(post).not.toHaveProperty('published'); // Not selected
          }
        }
      }
    });
  });

  describe('with() alias', () => {
    test('should work as alias for include()', async () => {
      const users = db.table<User>('users');

      const usersWithPosts = await users
        .with('posts')
        .where(eq('name', 'Alice'))
        .all();

      const alice = usersWithPosts[0];
      expect(alice.posts).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent relationships gracefully', async () => {
      const users = db.table<User>('users');

      // This should not throw an error, just log a warning
      const result = await users
        .include('nonExistentRelation')
        .where(eq('name', 'Alice'))
        .all();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('nonExistentRelation');
    });
  });
});