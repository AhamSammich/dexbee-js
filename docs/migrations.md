# Schema Migrations

DexBee provides optional schema migration capabilities for evolving your database structure over time.

## When to Use Migrations

### ✅ Use DexBee migrations if:
- You have 5+ tables with evolving schemas
- You're only adding new tables/fields (never removing)
- Schema changes frequently during development
- You want automatic migration generation

### ❌ Skip migrations if:
- Data is cached from a server (just clear and rebuild)
- You have 1-3 stable tables
- You need to remove/rename fields often
- Data is disposable or easily recreated

## Quick Start

```typescript
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

// 1. Connect to your database
const db = await DexBee.connect('myapp', currentSchema)

// 2. Add migration capabilities (only if needed!)
const migratable = withMigrations(db)

// 3. Preview what will change
const dryRun = await migratable.dryRunMigration(newSchema)
console.log('Operations:', dryRun.operations)
console.log('Warnings:', dryRun.warnings)

// 4. Apply if safe
if (dryRun.isValid && dryRun.warnings.length === 0) {
  await migratable.migrate(newSchema)
}
```

---

## Common Patterns for Schema Changes

Choose the pattern that matches your use case:

### Pattern 1: Cache-First (Simplest)

**Best for:** API caches, offline queues, ephemeral data

Your data can be rebuilt from the server, so just clear and reconnect:

```typescript
import { DexBee } from 'dexbee-js'

async function connectDB(schema: DatabaseSchema) {
  try {
    return await DexBee.connect('myapp-cache', schema)
  } catch (error) {
    // Schema changed? Clear and rebuild
    console.info('Schema changed, clearing cache...')
    await DexBee.delete('myapp-cache')
    return await DexBee.connect('myapp-cache', schema)
  }
}

// Usage
const db = await connectDB(mySchema)
// Cache is fresh with new schema
```

**Pros:**
- ✅ Zero migration code needed
- ✅ Always in sync with latest schema
- ✅ No risk of migration failures

**Cons:**
- ❌ Temporary data loss (acceptable for caches)

---

### Pattern 2: Additive-Only Migrations (Recommended)

**Best for:** Apps with growing schemas that never remove fields

DexBee automatically handles safe additive changes:

```typescript
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

// v1 Schema
const schemaV1 = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true }
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
}

// v2 Schema (only additions!)
const schemaV2 = {
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        // NEW: Added fields with defaults - existing records unaffected
        avatar: { type: 'string' },  // Optional
        createdAt: { type: 'date', default: () => new Date() },
        preferences: { type: 'object', default: () => ({ theme: 'light' }) }
      },
      primaryKey: 'id',
      autoIncrement: true
    },
    // NEW: Entire new table
    sessions: {
      schema: {
        id: { type: 'string', required: true },
        userId: { type: 'number', required: true },
        token: { type: 'string', required: true }
      },
      primaryKey: 'id'
    }
  }
}

// Apply migration (100% safe, no data loss)
const db = await DexBee.connect('myapp', schemaV1)
const migratable = withMigrations(db)

const dryRun = await migratable.dryRunMigration(schemaV2)
if (dryRun.warnings.length === 0) {
  // No warnings = perfectly safe!
  await migratable.migrate(schemaV2)
}
```

**Field renaming workaround:**

Instead of renaming (which requires transformation), add a new field:

```typescript
const schema = {
  version: 2,
  tables: {
    users: {
      schema: {
        name: { type: 'string' },     // Keep for old records
        fullName: { type: 'string' }  // New preferred field
      }
    }
  }
}

// In your app code:
const displayName = user.fullName || user.name
```

**Pros:**
- ✅ Zero data loss risk
- ✅ Automatic migration generation
- ✅ Works with DexBee migrations perfectly

**Cons:**
- ❌ Database grows with deprecated fields
- ❌ Can't rename/remove fields easily

---

### Pattern 3: Manual Backup for Critical Data

**Best for:** Offline-first apps with user-generated content

When you need destructive changes (drop field/table), create your own backup:

```typescript
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

// Helper: Export entire database
async function exportDatabase(db: Database): Promise<any> {
  const backup: any = {
    version: db.getSchema().version,
    timestamp: new Date().toISOString(),
    tables: {}
  }

  const tableNames = Object.keys(db.getSchema().tables)
  for (const tableName of tableNames) {
    backup.tables[tableName] = await db.table(tableName).all()
  }

  return backup
}

// Helper: Import database from backup
async function importDatabase(db: Database, backup: any): Promise<void> {
  for (const [tableName, records] of Object.entries(backup.tables)) {
    const table = db.table(tableName)
    await table.clear()
    for (const record of records as any[]) {
      await table.insert(record)
    }
  }
}

// Safe migration workflow
const db = await DexBee.connect('myapp', currentSchema)
const migratable = withMigrations(db)

const dryRun = await migratable.dryRunMigration(newSchema)

// Check for destructive operations
const hasDestructiveOps = dryRun.warnings.some(w =>
  w.includes('destructive') || w.includes('data loss')
)

if (hasDestructiveOps) {
  console.warn('⚠️ Destructive migration detected!')
  console.warn('Warnings:', dryRun.warnings)

  // Create REAL backup
  console.info('Creating backup...')
  const backup = await exportDatabase(db)
  localStorage.setItem('db-backup', JSON.stringify(backup))

  // Or download as file
  downloadJSON(backup, `backup-${Date.now()}.json`)

  // Ask user for confirmation
  const confirmed = confirm(
    'This migration may delete data. A backup has been created. Continue?'
  )
  if (!confirmed) {
    throw new Error('Migration cancelled by user')
  }
}

// Apply migration
try {
  await migratable.migrate(newSchema)
  console.info('✅ Migration successful')
  localStorage.removeItem('db-backup')
} catch (error) {
  console.error('❌ Migration failed:', error)

  // Restore from backup
  const backup = JSON.parse(localStorage.getItem('db-backup')!)
  await importDatabase(db, backup)
  console.info('✅ Restored from backup')

  throw error
}
```

**Pros:**
- ✅ Real data protection
- ✅ User-controlled
- ✅ Can save backup externally (download, cloud)

**Cons:**
- ❌ Requires manual implementation
- ❌ Large databases = large backups
- ❌ Restore is slow for large datasets

---

### Pattern 4: Versioned Database Names

**Best for:** Apps needing true rollback capability

Use separate databases for each schema version:

```typescript
const DB_VERSION = 'v3'
const schema = { version: 1, tables: { /* ... */ } }

// Connect to versioned database
const db = await DexBee.connect(`myapp-${DB_VERSION}`, schema)

// Rollback = just change DB_VERSION back to 'v2' and redeploy

// Migration from old version
const oldDbName = `myapp-v2`
const oldDbExists = await checkDatabaseExists(oldDbName)

if (oldDbExists) {
  console.info('Migrating from v2...')

  const oldDb = await DexBee.connect(oldDbName, oldSchema)

  // Copy data table by table
  const users = await oldDb.table('users').all()
  for (const user of users) {
    await db.table('users').insert(transformUser(user))
  }

  await oldDb.close()
  await DexBee.delete(oldDbName)  // Clean up
}

function checkDatabaseExists(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open(name)
    request.onsuccess = () => {
      request.result.close()
      resolve(true)
    }
    request.onerror = () => resolve(false)
  })
}
```

**Pros:**
- ✅ True rollback capability (just switch version)
- ✅ Gradual migration (can take time)
- ✅ Test new schema before committing
- ✅ Easy to A/B test schemas

**Cons:**
- ❌ Requires migration logic
- ❌ Temporarily uses 2x storage

---

## API Reference

### `withMigrations(database)`

Adds migration capabilities to a Database instance.

```typescript
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

const db = await DexBee.connect('mydb', schema)
const migratable = withMigrations(db)
```

**Returns:** `MigratableDatabase` with these additional methods:

---

### `migrate(newSchema, options?)`

Apply a schema migration.

```typescript
const result = await migratable.migrate(newSchema, {
  validateEachStep: true  // Validate after each operation (default: true)
})

console.log('Success:', result.success)
console.log('Operations:', result.operationsExecuted)
console.log('Duration:', result.duration, 'ms')
```

**Options:**
- `dryRun?: boolean` – Test without applying (default: false)
- `validateEachStep?: boolean` – Validate after each operation (default: true)
- `batchSize?: number` – Batch size for data transformations

**Returns:** `Promise<MigrationResult>`

---

### `dryRunMigration(newSchema, options?)`

Preview migration without applying changes.

```typescript
const dryRun = await migratable.dryRunMigration(newSchema)

console.log('Valid:', dryRun.isValid)
console.log('Operations:', dryRun.operations)
console.log('Warnings:', dryRun.warnings)
console.log('Errors:', dryRun.errors)

// Check for destructive operations
const hasDestructive = dryRun.warnings.some(w => w.includes('destructive'))
```

**Returns:** `Promise<DryRunResult>`

---

### `getMigrationStatus()`

Get current schema version.

```typescript
const status = await migratable.getMigrationStatus()
console.log('Current version:', status.currentVersion)
```

**Returns:** `Promise<MigrationStatus>`

---

## What DexBee Migrations Do

**Automatic detection of:**
- ✅ Added tables
- ✅ Added fields (with defaults)
- ✅ Added indexes
- ✅ Removed tables (warns about data loss)
- ✅ Removed fields (warns about data loss)
- ✅ Modified field types (warns if risky)

**Safety features:**
- ✅ Dry run validation before applying
- ✅ Warnings for destructive operations
- ✅ Step-by-step validation
- ✅ Automatic operation generation

**What's NOT included:**
- ❌ Automatic backups (you implement it, see Pattern 3)
- ❌ Automatic rollback (use Pattern 4 for true rollback)
- ❌ Data transformation helpers (write your own)

---

## Decision Tree

```
Is your data disposable/cached from server?
├─ YES → Pattern 1: Cache-First (no migration code needed)
└─ NO → Do you only add fields/tables (never remove)?
    ├─ YES → Pattern 2: Additive-Only Migrations (use DexBee)
    └─ NO → Do you have critical user data?
        ├─ YES → Pattern 3: Manual Backup
        └─ NO → Pattern 4: Versioned Database Names
```

---

## Bundle Size

The migration system is **optional** and tree-shakeable:

- **Core DexBee:** 33KB (without migrations)
- **With migrations:** +17KB (only when imported)
- **Total:** 50KB (when using migrations)

If you don't import from `'dexbee-js/migrations'`, you pay zero bytes.

---

## Examples

See `examples/migrations-demo.ts` for complete working examples of all patterns.

---

## Migration FAQ

### Q: Should I use migrations?

**A:** Only if your schema changes frequently AND you can't just clear the database. Most apps (caches, offline queues) should use Pattern 1.

### Q: Can I remove/rename fields?

**A:** Not automatically. Use Pattern 3 (manual backup) or Pattern 4 (versioned DBs) for destructive changes.

### Q: What happens if migration fails?

**A:** The database remains in its original state. No partial migrations. Use Pattern 3 for critical data protection.

### Q: Can I rollback?

**A:** Not automatically. Use Pattern 4 (versioned database names) for true rollback capability.

### Q: How do I handle data transformations?

**A:** Write custom migration logic. DexBee detects schema changes, but you write transformation code for complex data changes.

---

## Migration Limitations

DexBee migrations are designed for **safe additive changes**. For complex scenarios:

- **Destructive changes:** Use manual backups (Pattern 3)
- **Data transformations:** Write custom code
- **Rollback needs:** Use versioned databases (Pattern 4)
- **Complex workflows:** Consider server-side migration logic

The migration system is intentionally simple and honest about its capabilities.
