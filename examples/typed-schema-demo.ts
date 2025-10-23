/**
 * Demonstrates fully typed schema definitions with automatic TypeScript inference.
 *
 * This example shows how to use DexBee with complete type safety - the database
 * instance is fully typed based on the schema definition, similar to supabase-js.
 *
 * Key points:
 * 1. Use `as const` when defining your schema for best type inference
 * 2. The db.table() method returns a fully typed Table instance
 * 3. TypeScript knows the exact shape of your records
 * 4. Insert, update, and query operations are all type-checked
 */

import { defineSchema, DexBee } from '../src/index.js'

// ============================================================================
// Define your schema with `as const` for type inference
// ============================================================================

const schema = defineSchema({
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        age: { type: 'number' }, // Optional field
        isActive: { type: 'boolean', default: () => true },
        createdAt: { type: 'date', default: () => new Date() },
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'email_idx', keyPath: 'email', unique: true },
      ],
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string' },
        userId: { type: 'number', required: true },
        published: { type: 'boolean', default: () => false },
        tags: { type: 'array', default: () => [] },
        createdAt: { type: 'date', default: () => new Date() },
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'userId_idx', keyPath: 'userId' },
      ],
    },
  },
} as const)

// ============================================================================
// TypeScript automatically infers the types!
// ============================================================================

async function demonstrateTypedSchema(): Promise<void> {
  console.log('🎯 DexBee Typed Schema Demo')
  console.log('================================')

  // ============================================================================
  // Connect to database - fully typed!
  // ============================================================================

  const db = await DexBee.connect('typed-demo-db', schema)
  console.log('✅ Connected to database')

  // ============================================================================
  // Get table instances - TypeScript knows the exact types!
  // ============================================================================

  const usersTable = db.table('users')
  // TypeScript knows: Table<{ id: number; name: string; email: string; age?: number; ... }>

  const postsTable = db.table('posts')
  // TypeScript knows: Table<{ id: number; title: string; content?: string; ... }>

  // ❌ This would be a TypeScript error:
  // const invalidTable = db.table('nonexistent')

  // ============================================================================
  // INSERT - Type-checked at compile time
  // ============================================================================

  console.log('\n📝 Inserting users...')

  const newUser = await usersTable.insert({
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    // TypeScript ensures all required fields are present
    // and prevents invalid fields
  })

  console.log(`✅ Inserted user: ${newUser.name} (ID: ${newUser.id})`)

  // Insert without optional fields - perfectly valid
  const user2 = await usersTable.insert({
    name: 'Bob Smith',
    email: 'bob@example.com',
    // age is optional, so we can omit it
  })

  console.log(`✅ Inserted user: ${user2.name} (ID: ${user2.id})`)

  // ❌ TypeScript would catch these errors at compile time:
  // await usersTable.insert({ name: 'Invalid' }) // Missing required 'email'
  // await usersTable.insert({ name: 123, email: 'test@example.com' }) // Wrong type
  // await usersTable.insert({ name: 'Test', email: 'test@example.com', invalidField: true }) // Invalid field

  // ============================================================================
  // BULK INSERT - All type-checked
  // ============================================================================

  console.log('\n📝 Inserting multiple users...')

  const moreUsers = await usersTable.insertMany([
    { name: 'Charlie Davis', email: 'charlie@example.com', age: 35 },
    { name: 'Diana Evans', email: 'diana@example.com', age: 22 },
    { name: 'Eve Foster', email: 'eve@example.com' }, // age is optional
  ])

  console.log(`✅ Inserted ${moreUsers.length} users`)

  // ============================================================================
  // QUERY - Results are fully typed
  // ============================================================================

  console.log('\n🔍 Querying users...')

  // Get all users - TypeScript knows this returns User[]
  const allUsers = await usersTable.all()
  console.log(`✅ Found ${allUsers.length} total users`)

  // TypeScript knows the shape of each user
  allUsers.forEach((user) => {
    // user.name is string
    // user.email is string
    // user.age is number | undefined
    console.log(`  - ${user.name} (${user.email})${user.age ? ` - Age: ${user.age}` : ''}`)
  })

  // Find by ID - returns User | null
  const foundUser = await usersTable.findById(1)
  if (foundUser) {
    console.log(`\n✅ Found user by ID: ${foundUser.name}`)
    // TypeScript knows foundUser has all User properties
  }

  // ============================================================================
  // UPDATE - Type-checked partial updates
  // ============================================================================

  console.log('\n📝 Updating user...')

  const updatedUser = await usersTable.update(1, {
    age: 29, // Can update any field
    isActive: true,
  })

  console.log(`✅ Updated ${updatedUser.name}'s age to ${updatedUser.age}`)

  // ❌ TypeScript would catch:
  // await usersTable.update(1, { invalidField: true })
  // await usersTable.update(1, { age: 'not a number' })

  // ============================================================================
  // RELATIONSHIPS - Insert related data
  // ============================================================================

  console.log('\n📝 Creating posts...')

  const post1 = await postsTable.insert({
    title: 'Getting Started with DexBee',
    content: 'DexBee makes IndexedDB easy and type-safe!',
    userId: newUser.id,
    published: true,
    tags: ['tutorial', 'indexeddb', 'typescript'],
  })

  console.log(`✅ Created post: "${post1.title}" by user ${post1.userId}`)

  const post2 = await postsTable.insert({
    title: 'Type Safety in the Browser',
    content: 'Full TypeScript support out of the box',
    userId: user2.id,
    tags: ['typescript', 'type-safety'],
  })

  console.log(`✅ Created post: "${post2.title}" by user ${post2.userId}`)

  // ============================================================================
  // COMPLEX QUERIES - All typed
  // ============================================================================

  console.log('\n🔍 Complex queries...')

  // Get all posts - TypeScript knows this returns Post[]
  const allPosts = await postsTable.all()

  console.log(`✅ Found ${allPosts.length} posts:`)
  allPosts.forEach((post) => {
    // TypeScript knows the exact shape
    console.log(`  - "${post.title}" (${post.tags?.length || 0} tags)`)
  })

  // ============================================================================
  // TYPE INFERENCE WITH SELECT
  // ============================================================================

  console.log('\n🔍 Selective field queries...')

  // Select specific fields - TypeScript narrows the type
  const userEmails = await usersTable.select('name', 'email').all()
  // Type: Array<{ name: string; email: string }>

  console.log('✅ User emails:')
  userEmails.forEach((user) => {
    // user.name ✅
    // user.email ✅
    // user.age ❌ (not selected)
    console.log(`  - ${user.name}: ${user.email}`)
  })

  // ============================================================================
  // TYPE SAFETY WITH OPERATORS
  // ============================================================================

  console.log('\n🔍 Filtered queries...')

  // Import operators (shown in comments to demonstrate usage)
  // import { eq, gt, and } from '../src/index.js'

  // These operators are type-checked against the schema:
  // const adults = await usersTable.where(gt('age', 18)).all()
  // const activeUser = await usersTable.where(eq('email', 'alice@example.com')).first()

  // ❌ TypeScript would catch:
  // await usersTable.where(gt('nonexistentField', 10)).all()
  // await usersTable.where(eq('age', 'not a number')).all()

  // ============================================================================
  // Cleanup
  // ============================================================================

  console.log('\n✨ Type Safety Summary:')
  console.log('  ✅ Table names are type-checked')
  console.log('  ✅ Field names are type-checked')
  console.log('  ✅ Field types are enforced')
  console.log('  ✅ Required fields are validated')
  console.log('  ✅ Query results are fully typed')
  console.log('  ✅ Select narrows the result type')
  console.log('  ✅ Insert/Update operations are type-safe')

  db.close()
  console.log('\n🔌 Database connection closed')
}

// Run the demonstration
demonstrateTypedSchema().catch((error) => {
  console.error('❌ Demo failed:', error)
  throw error
})
