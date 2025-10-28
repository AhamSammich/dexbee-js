/* eslint-disable perfectionist/sort-imports */
/**
 * DexBee Migration System Demo
 *
 * This example demonstrates how to use DexBee's enterprise-grade migration system
 * to safely evolve your database schema over time.
 *
 * Key concepts:
 * - Separate import for migrations (keeps core bundle small)
 * - Plugin architecture with withMigrations()
 * - Dry run validation before applying changes
 * - Safety options (backup, rollback, validation)
 * - Multi-step schema evolution
 */

import 'fake-indexeddb/auto'
import { defineSchema, DexBee } from '../src/index.js'
import { withMigrations } from '../src/migrations.js'

// =============================================================================
// SCHEMA VERSIONS
// =============================================================================

/**
 * Version 1: Initial schema with just a users table
 */
const v1Schema = defineSchema({
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        age: { type: 'number', required: false },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
})

/**
 * Version 2: Add email field and posts table
 */
const v2Schema = defineSchema({
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        age: { type: 'number', required: false },
        email: { type: 'string', required: false, default: () => '' }, // New field
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [{ name: 'email_idx', keyPath: 'email', unique: true }],
    },
    posts: {
      // New table
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        authorId: { type: 'number', required: true },
        publishedAt: { type: 'date', required: false },
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [{ name: 'author_idx', keyPath: 'authorId' }],
    },
  },
})

/**
 * Version 3: Add categories and split user name into firstName/lastName
 */
const v3Schema = defineSchema({
  version: 3,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        firstName: { type: 'string', required: true }, // Split from name
        lastName: { type: 'string', required: true }, // Split from name
        age: { type: 'number', required: false },
        email: { type: 'string', required: false, default: () => '' },
        department: { type: 'string', required: false, default: () => 'general' }, // New field
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [{ name: 'email_idx', keyPath: 'email', unique: true }],
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        authorId: { type: 'number', required: true },
        publishedAt: { type: 'date', required: false },
        categoryId: { type: 'number', required: false, default: () => 1 }, // New field
        viewCount: { type: 'number', required: false, default: () => 0 }, // New field
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'author_idx', keyPath: 'authorId' },
        { name: 'category_idx', keyPath: 'categoryId' },
      ],
    },
    categories: {
      // New table
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        description: { type: 'string', required: false },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
})

// =============================================================================
// MIGRATION WORKFLOW
// =============================================================================

async function runMigrationDemo(): Promise<void> {
  console.log('🐝 DexBee Migration System Demo\n')

  // ---------------------------------------------------------------------------
  // Step 1: Initial Database Setup (Version 1)
  // ---------------------------------------------------------------------------
  console.log('📦 Step 1: Creating database with initial schema (v1)...')

  const db = await DexBee.connect('migration-demo', v1Schema)
  const users = db.table('users')

  // Add some initial data
  await users.insert({ name: 'Alice Johnson', age: 30 })
  await users.insert({ name: 'Bob Smith', age: 25 })
  await users.insert({ name: 'Carol Davis', age: 35 })

  console.log('✅ Database created with 3 users')
  console.log('   Current version:', v1Schema.version)

  // Close the connection
  db.close()

  // ---------------------------------------------------------------------------
  // Step 2: Add Migration Capabilities
  // ---------------------------------------------------------------------------
  console.log('\n🔧 Step 2: Adding migration capabilities...')

  // Reconnect to add migration features
  const db2 = await DexBee.connect('migration-demo', v1Schema)
  const migratable = withMigrations(db2)

  console.log('✅ Migration capabilities added via withMigrations()')

  // ---------------------------------------------------------------------------
  // Step 3: Preview Migration (Dry Run)
  // ---------------------------------------------------------------------------
  console.log('\n🔍 Step 3: Previewing migration to v2 (dry run)...')

  const dryRun = await migratable.dryRunMigration(v2Schema)

  console.log(`   Valid: ${dryRun.isValid}`)
  console.log(`   Operations: ${dryRun.operations.length}`)
  console.log(`   Warnings: ${dryRun.warnings.length}`)
  console.log(`   Errors: ${dryRun.errors.length}`)

  if (dryRun.operations.length > 0) {
    console.log('\n   Planned operations:')
    dryRun.operations.forEach((op, i) => {
      console.log(`   ${i + 1}. ${op.type} on ${op.tableName}`)
    })
  }

  if (dryRun.warnings.length > 0) {
    console.log('\n   ⚠️  Warnings:')
    dryRun.warnings.forEach((warning) => {
      console.log(`   - ${warning}`)
    })
  }

  if (!dryRun.isValid) {
    console.log('\n   ❌ Migration validation failed:')
    dryRun.errors.forEach((error) => {
      console.log(`   - ${error}`)
    })
    return
  }

  // ---------------------------------------------------------------------------
  // Step 4: Apply Migration with Safety Options
  // ---------------------------------------------------------------------------
  console.log('\n🚀 Step 4: Applying migration to v2...')

  // Close current connection before migration
  db2.close()

  // Reconnect with new schema to trigger migration
  const db3 = await DexBee.connect('migration-demo', v2Schema)
  const migratable2 = withMigrations(db3)

  const migrationResult = await migratable2.migrate(v2Schema, {
    createBackup: true, // Create backup before migration
    rollbackOnError: true, // Auto-rollback if anything fails
    validateEachStep: true, // Validate after each operation
  })

  if (migrationResult.success) {
    console.log('✅ Migration completed successfully!')
    console.log(`   Operations executed: ${migrationResult.operationsExecuted}`)
    console.log(`   Duration: ${migrationResult.duration}ms`)
  } else {
    console.log('❌ Migration failed:')
    migrationResult.errors?.forEach((error) => {
      console.log(`   - ${error}`)
    })
    return
  }

  // ---------------------------------------------------------------------------
  // Step 5: Verify Data Preservation
  // ---------------------------------------------------------------------------
  console.log('\n✓ Step 5: Verifying data preservation...')

  const users2 = db3.table('users')
  const allUsers = await users2.all()

  console.log(`   Users count: ${allUsers.length}`)
  console.log('   Sample user:', {
    name: allUsers[0]?.name,
    age: allUsers[0]?.age,
    email: allUsers[0]?.email, // New field with default value
  })

  // Verify new table exists
  const posts = db3.table('posts')
  await posts.insert({
    title: 'First Post',
    content: 'Hello DexBee!',
    authorId: allUsers[0]!.id,
    publishedAt: new Date(),
  })

  const allPosts = await posts.all()
  console.log(`   Posts count: ${allPosts.length}`)

  // ---------------------------------------------------------------------------
  // Step 6: Check Migration Status
  // ---------------------------------------------------------------------------
  console.log('\n📊 Step 6: Checking migration status...')

  const status = await migratable2.getMigrationStatus()

  console.log(`   Current version: ${status.currentVersion}`)
  console.log(`   Up to date: ${status.isUpToDate}`)

  if (status.lastAppliedMigration) {
    console.log(`   Last applied: v${status.lastAppliedMigration.version}`)
    console.log(`   Applied at: ${status.lastAppliedMigration.appliedAt.toISOString()}`)
    console.log(`   Duration: ${status.lastAppliedMigration.duration}ms`)
  }

  db3.close()

  // ---------------------------------------------------------------------------
  // Step 7: Multi-Step Migration (v2 → v3)
  // ---------------------------------------------------------------------------
  console.log('\n🔄 Step 7: Multi-step migration to v3...')

  const db4 = await DexBee.connect('migration-demo', v2Schema)
  const migratable3 = withMigrations(db4)

  // Preview v3 migration
  const dryRunV3 = await migratable3.dryRunMigration(v3Schema)
  console.log(`   Operations for v2→v3: ${dryRunV3.operations.length}`)

  if (dryRunV3.isValid) {
    db4.close()

    // Apply v3 migration
    const db5 = await DexBee.connect('migration-demo', v3Schema)
    const migratable4 = withMigrations(db5)

    const resultV3 = await migratable4.migrate(v3Schema, {
      createBackup: true,
      rollbackOnError: true,
    })

    if (resultV3.success) {
      console.log('✅ Migration to v3 completed!')
      console.log(`   Operations executed: ${resultV3.operationsExecuted}`)

      // Verify new table
      const categories = db5.table('categories')
      await categories.insert({ name: 'Technology', description: 'Tech posts' })
      await categories.insert({ name: 'Lifestyle', description: 'Life posts' })

      const allCategories = await categories.all()
      console.log(`   Categories count: ${allCategories.length}`)
    }

    // Final status
    const finalStatus = await migratable4.getMigrationStatus()
    console.log(`\n📈 Final status:`)
    console.log(`   Current version: ${finalStatus.currentVersion}`)
    console.log(`   Up to date: ${finalStatus.isUpToDate}`)

    db5.close()
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  console.log('\n🧹 Cleaning up demo database...')

  // Delete the demo database
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('migration-demo')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  console.log('✅ Demo completed!\n')
}

// =============================================================================
// BEST PRACTICES SUMMARY
// =============================================================================

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  MIGRATION BEST PRACTICES                      ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  1. ✅ Always do a dry run first                              ║
║     const dryRun = await migratable.dryRunMigration(newSchema)║
║                                                                ║
║  2. ✅ Check validation results                               ║
║     if (!dryRun.isValid) { handle errors }                    ║
║                                                                ║
║  3. ✅ Use safety options                                     ║
║     createBackup: true                                         ║
║     rollbackOnError: true                                      ║
║     validateEachStep: true                                     ║
║                                                                ║
║  4. ✅ Increment version numbers                              ║
║     v1 → v2 → v3 (don't skip)                                 ║
║                                                                ║
║  5. ✅ Provide default values for new fields                  ║
║     email: { type: 'string', default: () => '' }              ║
║                                                                ║
║  6. ✅ Test migrations thoroughly                             ║
║     Use integration tests with fake-indexeddb                  ║
║                                                                ║
║  7. ✅ Monitor migration status                               ║
║     const status = await migratable.getMigrationStatus()      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`)

// Run the demo
runMigrationDemo().catch(console.error)
