import type { DatabaseSchema } from '../src/index.js'
import { DexBee } from '../src/index.js'

// Define schema
const schema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', unique: true },
        age: { type: 'number', index: true },
        isActive: { type: 'boolean', default: () => true },
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'email_idx', keyPath: 'email', unique: true },
        { name: 'age_idx', keyPath: 'age' },
      ],
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string' },
        userId: { type: 'number', required: true },
        createdAt: { type: 'date', default: () => new Date() },
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'userId_idx', keyPath: 'userId' },
      ],
    },
  },
}

async function demonstratePhase1(): Promise<void> {
  console.log('🚀 DexBee Phase 1 Demo')

  try {
    // Create and connect to database
    const db = await DexBee.connect('demo-db', schema)
    console.log('✅ Connected to database')

    // Create some users
    const users = [
      { name: 'Alice Johnson', email: 'alice@example.com', age: 28 },
      { name: 'Bob Smith', email: 'bob@example.com', age: 35 },
      { name: 'Carol Davis', email: 'carol@example.com', age: 22 },
    ]

    // Insert users with transaction management
    for (const userData of users) {
      await db.withWriteTransaction(['users'], async (tx) => {
        const store = tx.getStore('users')

        // Apply defaults and validate
        const processedUser = db.applyDefaults('users', userData)
        db.validateData('users', processedUser)

        console.log('📝 Inserting user:', processedUser)

        // Insert user
        const request = store.add(processedUser)

        return new Promise<void>((resolve, reject) => {
          request.onsuccess = () => {
            console.log('✅ User inserted with ID:', request.result)
            resolve()
          }
          request.onerror = () => reject(request.error)
        })
      })
    }

    // Read all users back
    const allUsers = await db.withReadTransaction(['users'], async (tx) => {
      const store = tx.getStore('users')
      const request = store.getAll()

      return new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    })

    console.log('👥 All users in database:')
    allUsers.forEach((user) => {
      console.log(`  - ${user.name} (${user.email}) - Age: ${user.age}, Active: ${user.isActive}`)
    })

    // Create some posts
    await db.withWriteTransaction(['posts'], async (tx) => {
      const store = tx.getStore('posts')

      const posts = [
        { title: 'Hello World', content: 'First post!', userId: 1 },
        { title: 'IndexedDB is great', content: 'Working with DexBee...', userId: 2 },
        { title: 'Phase 1 Complete', content: 'Core infrastructure ready!', userId: 1 },
      ]

      for (const postData of posts) {
        const processedPost = db.applyDefaults('posts', postData)
        db.validateData('posts', processedPost)

        const request = store.add(processedPost)

        await new Promise<void>((resolve, reject) => {
          request.onsuccess = () => {
            console.log('📄 Post inserted:', processedPost.title)
            resolve()
          }
          request.onerror = () => reject(request.error)
        })
      }
    })

    // Read posts with user lookup
    const allPosts = await db.withReadTransaction(['posts'], async (tx) => {
      const store = tx.getStore('posts')
      const request = store.getAll()

      return new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    })

    console.log('📚 All posts in database:')
    allPosts.forEach((post) => {
      const user = allUsers.find(u => u.id === post.userId)
      console.log(`  - "${post.title}" by ${user?.name || 'Unknown'} (${post.createdAt})`)
    })

    console.log('🎉 Phase 1 Demo completed successfully!')
    console.log(`📊 Active transactions: ${db.getActiveTransactionCount()}`)

    // Close database
    db.close()
    console.log('🔌 Database connection closed')
  }
  catch (error) {
    console.error('❌ Demo failed:', error)
    throw error
  }
}

// Run the demo
demonstratePhase1().catch(console.error)
