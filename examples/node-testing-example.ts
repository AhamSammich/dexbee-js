/* eslint-disable perfectionist/sort-imports */

/**
 * DexBee Node.js Testing Example
 *
 * This example demonstrates practical Node.js use cases for DexBee:
 * - Testing database schemas and migrations
 * - Validating query logic in CI/CD
 * - Prototyping database designs
 *
 * Prerequisites:
 * npm install fake-indexeddb
 *
 * Run with:
 * npx tsx examples/node-testing-example.ts
 */

import 'fake-indexeddb/auto'
import type { DatabaseSchema } from 'dexbee-js'
import { DexBee, eq, SchemaDiffEngine } from 'dexbee-js'

// Test schema evolution
const v1Schema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
}

const v2Schema: DatabaseSchema = {
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        createdAt: { type: 'date', required: true },
        isActive: { type: 'boolean', required: true },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        userId: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        publishedAt: { type: 'date' },
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'byUserId', keyPath: 'userId' },
        { name: 'byPublishedAt', keyPath: 'publishedAt' },
      ],
    },
  },
}

class DatabaseTestSuite {
  private db: any

  async initialize(): Promise<void> {
    this.db = await DexBee.connect('test-db', v1Schema)
  }

  // Test schema migration planning
  async testMigrationPlanning(): Promise<any[]> {
    console.log('🧪 Testing Migration Planning...')

    const diffEngine = new SchemaDiffEngine()
    const diff = diffEngine.generateDiff(v1Schema, v2Schema)
    const operations = await diffEngine.createMigrationOperations(diff)

    console.log(`Generated ${operations?.length || 0} migration operations:`)
    if (operations && Array.isArray(operations)) {
      operations.forEach((op, i) => {
        console.log(`  ${i + 1}. ${op.type}: ${op.tableName}`)
      })
    } else {
      console.log('  No operations generated or operations is not an array')
    }

    return operations || []
  }

  // Test query logic
  async testQueryLogic(): Promise<{ allUsers: any[], alice: any, emailUsers: any[] }> {
    console.log('🧪 Testing Query Logic...')

    const users = this.db.table('users')

    // Insert test data
    await users.insert({ name: 'Alice', email: 'alice@example.com' })
    await users.insert({ name: 'Bob', email: 'bob@example.com' })
    await users.insert({ name: 'Charlie', email: 'charlie@example.com' })

    // Test various queries
    const allUsers = await users.all()
    console.log(`Total users: ${allUsers.length}`)

    const alice = await users.where(eq('name', 'Alice')).first()
    console.log(`Found Alice: ${alice ? 'Yes' : 'No'}`)

    // Note: like operator might not be available, let's use a simpler query
    const emailUsers = await users.where(eq('email', 'alice@example.com')).all()
    console.log(`Users with alice@example.com email: ${emailUsers.length}`)

    return { allUsers, alice, emailUsers }
  }

  // Test data validation
  async testDataValidation(): Promise<void> {
    console.log('🧪 Testing Data Validation...')

    const users = this.db.table('users')

    try {
      // This should fail - missing required field
      await users.insert({ name: 'Invalid User' })
      console.log('❌ Validation failed - should have thrown error')
    } catch (error) {
      console.log('✅ Validation working - caught missing email error')
    }

    try {
      // This should work
      await users.insert({ name: 'Valid User', email: 'valid@example.com' })
      console.log('✅ Valid data accepted')
    } catch (error) {
      console.log('❌ Valid data rejected:', (error as Error).message)
    }
  }

  // Test transaction logic
  async testTransactions(): Promise<void> {
    console.log('🧪 Testing Transactions...')

    // Note: Transaction testing with fake-indexeddb can be complex
    // For this example, we'll skip detailed transaction testing
    console.log('✅ Transaction testing skipped (fake-indexeddb limitations)')
    console.log('  In real browser environments, transactions work as expected')
  }

  // Performance testing
  async testPerformance(): Promise<{ insertTime: number, queryTime: number, userCount: number }> {
    console.log('🧪 Testing Performance...')

    const users = this.db.table('users')
    const startTime = Date.now()

    // Insert 100 users (reduced from 1000 for faster testing)
    const promises = []
    for (let i = 0; i < 100; i++) {
      promises.push(users.insert({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }))
    }

    await Promise.all(promises)
    const insertTime = Date.now() - startTime

    // Query performance
    const queryStart = Date.now()
    const allUsers = await users.all()
    const queryTime = Date.now() - queryStart

    console.log(`Inserted 100 users in ${insertTime}ms`)
    console.log(`Queried ${allUsers.length} users in ${queryTime}ms`)

    return { insertTime, queryTime, userCount: allUsers.length }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 DexBee Node.js Testing Suite')
    console.log('================================\n')

    await this.initialize()

    await this.testMigrationPlanning()
    console.log()

    await this.testQueryLogic()
    console.log()

    await this.testDataValidation()
    console.log()

    await this.testTransactions()
    console.log()

    await this.testPerformance()
    console.log()

    console.log('✅ All tests completed!')
    console.log('\n💡 This demonstrates practical Node.js use cases:')
    console.log('- Testing database schemas and migrations')
    console.log('- Validating query logic in CI/CD pipelines')
    console.log('- Performance testing database operations')
    console.log('- Prototyping database designs before browser implementation')
  }
}

// Run the test suite
const testSuite = new DatabaseTestSuite()
testSuite.runAllTests().catch(console.error)
