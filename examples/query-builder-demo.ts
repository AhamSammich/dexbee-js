// Query Builder Demo
// This example demonstrates the SQL-like query interface

import type { DatabaseSchema } from '../src/index.js'
import { and, DexBee, eq, gt, not, or } from '../src/index.js'

// Define types for type-safe queries
interface User {
  id: number
  name: string
  email: string
  age: number
  isActive: boolean
  createdAt: Date
}

interface Post {
  id: number
  userId: number
  title: string
  content: string
  published: boolean
}

// Define database schema
const schema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true, unique: true },
        age: { type: 'number', required: true, index: true },
        isActive: { type: 'boolean', default: () => true },
        createdAt: { type: 'date', default: () => new Date() },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        userId: { type: 'number', required: true, index: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        published: { type: 'boolean', default: () => false },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
}

async function demonstrateQueryBuilder(): Promise<void> {
  console.log('🚀 DexBee Query Builder Demo\n')

  // Connect to database
  const db = await DexBee.connect('demo-db', schema)
  const users = db.table<User>('users')
  const posts = db.table<Post>('posts')

  // 1. Insert sample data
  console.log('📝 Inserting sample data...')

  const sampleUsers = await users.insertMany([
    { name: 'Alice', email: 'alice@example.com', age: 25 },
    { name: 'Bob', email: 'bob@example.com', age: 35 },
    { name: 'Charlie', email: 'charlie@example.com', age: 17, isActive: false },
    { name: 'Diana', email: 'diana@example.com', age: 42 },
    { name: 'Eve', email: 'eve@example.com', age: 28, isActive: false },
  ])

  await posts.insertMany([
    { userId: 1, title: 'Hello World', content: 'First post', published: true },
    { userId: 1, title: 'Second Post', content: 'Another post' },
    { userId: 2, title: 'Bob\'s Post', content: 'Bob\'s content', published: true },
    { userId: 4, title: 'Diana\'s Thoughts', content: 'Diana\'s content', published: true },
  ])

  console.log(`✅ Inserted ${sampleUsers.length} users and 4 posts\n`)

  // 2. Basic queries
  console.log('🔍 Basic Query Operations:')

  const allUsers = await users.all()
  console.log(`   Total users: ${allUsers.length}`)

  const userCount = await users.count()
  console.log(`   Count query: ${userCount}`)

  const firstUser = await users.first()
  console.log(`   First user: ${firstUser?.name}\n`)

  // 3. Field selection
  console.log('🎯 Field Selection:')

  const namesAndEmails = await users.select('name', 'email').all()
  console.log('   Selected fields (name, email):')
  namesAndEmails.forEach(user =>
    console.log(`     ${user.name} - ${user.email}`),
  )
  console.log()

  // 4. Where conditions
  console.log('🔎 Where Conditions:')

  // Simple equality
  const alice = await users.where(eq('name', 'Alice')).first()
  console.log(`   User named Alice: ${alice?.email}`)

  // Comparison operators
  const adults = await users.where(gt('age', 21)).all()
  console.log(`   Adults (age > 21): ${adults.map(u => u.name).join(', ')}`)

  // 5. Logical operators
  console.log('\n🧠 Logical Operators:')

  // AND conditions
  const activeAdults = await users
    .where(and(
      gt('age', 20),
      eq('isActive', true),
    ))
    .all()
  console.log(`   Active adults: ${activeAdults.map(u => u.name).join(', ')}`)

  // OR conditions
  const aliceOrBob = await users
    .where(or(
      eq('name', 'Alice'),
      eq('name', 'Bob'),
    ))
    .all()
  console.log(`   Alice or Bob: ${aliceOrBob.map(u => u.name).join(', ')}`)

  // NOT conditions
  const inactive = await users.where(not(eq('isActive', true))).all()
  console.log(`   Inactive users: ${inactive.map(u => u.name).join(', ')}`)

  // 6. Ordering and pagination
  console.log('\n📊 Ordering and Pagination:')

  const oldestUsers = await users
    .orderBy('age', 'desc')
    .limit(3)
    .all()
  console.log('   Oldest 3 users:')
  oldestUsers.forEach(user =>
    console.log(`     ${user.name} (${user.age} years)`),
  )

  // 7. Complex queries
  console.log('\n🔥 Complex Query (The Target Vision):')

  // This was our target from the architecture plan!
  const targetQuery = await users
    .select('name', 'age', 'email')
    .where(gt('age', 18))
    .orderBy('name')
    .limit(10)
    .all()

  console.log('   SELECT name, email FROM users WHERE age > 18 ORDER BY name LIMIT 10:')
  targetQuery.forEach(user =>
    console.log(`     ${user.name} - ${user.email}`),
  )

  // 8. Multi-table operations
  console.log('\n📚 Multi-table Operations:')

  const publishedPosts = await posts.where(eq('published', true)).all()
  console.log(`   Published posts: ${publishedPosts.length}`)

  const alicePosts = await posts.where(eq('userId', 1)).all()
  console.log(`   Alice's posts: ${alicePosts.map(p => p.title).join(', ')}`)

  // 9. CRUD operations
  console.log('\n✏️ CRUD Operations:')

  // Create
  const newUser = await users.insert({
    name: 'Frank',
    email: 'frank@example.com',
    age: 30,
  })
  console.log(`   Inserted: ${newUser.name} (ID: ${newUser.id}, Active: ${newUser.isActive})`)

  // Read
  const frankById = await users.findById(newUser.id)
  console.log(`   Found by ID: ${frankById?.name}`)

  // Update
  const updatedFrank = await users.update(newUser.id, { age: 31 })
  console.log(`   Updated age: ${updatedFrank.name} is now ${updatedFrank.age}`)

  // Delete
  await users.delete(newUser.id)
  const deletedCheck = await users.findById(newUser.id)
  console.log(`   Deleted: ${deletedCheck ? 'Failed' : 'Success'}`)

  // 10. Summary
  console.log('\n🎉 Phase 2 Query Builder - COMPLETE!')
  console.log('\n✅ Features implemented:')
  console.log('   • Fluent query interface: select().where().orderBy().limit()')
  console.log('   • Type-safe field selection with IntelliSense')
  console.log('   • Comparison operators: eq, gt, lt, gte, lte, between, in, notIn')
  console.log('   • Logical operators: and, or, not')
  console.log('   • Execution methods: all(), first(), count()')
  console.log('   • CRUD operations: insert, findById, update, delete')
  console.log('   • Ordering and pagination: orderBy, limit, offset')
  console.log('   • Multi-table support with independent queries')
  console.log('   • Schema validation and default value application')

  console.log('\n🚀 Ready for production use!')

  db.close()
}

// Export for both ES modules and script tag usage
export { demonstrateQueryBuilder }

// Run demo if this file is executed directly
if (import.meta.url === new URL(import.meta.resolve('./query-builder-demo.ts')).href) {
  demonstrateQueryBuilder().catch(console.error)
}
