# Migration Guide: v0.4.x → v0.5.0

**Breaking Changes:** Removal of unimplemented backup/rollback features

---

## Overview

DexBee v0.5.0 removes the following features that were never fully implemented:
- `rollback()` method
- `createBackup` option
- `rollbackOnError` option  
- `backupCreated` result field

These features gave a false sense of security - they appeared to protect data but didn't actually work for destructive operations.

---

## What's Removed

### 1. Rollback Method

```typescript
// ❌ v0.4.x (Removed)
const migratable = withMigrations(db)
await migratable.migrate(newSchema)

if (somethingWrong) {
  await migratable.rollback(1)  // ← Didn't actually work!
}
```

**Why removed:**
- Only worked for trivial additive migrations
- Failed for destructive operations (drop table/field, transforms)
- Required storing inverse operations (not implemented)
- Gave users false confidence

### 2. Backup Options

```typescript
// ❌ v0.4.x (Removed)
await migratable.migrate(newSchema, {
  createBackup: true,        // ← Did nothing
  rollbackOnError: true      // ← Only worked for simple cases
})

console.log(result.backupCreated)  // ← Always true, even though no backup
```

**Why removed:**
- `createBackup` was just a comment in the code
- No actual backup creation happened
- `backupCreated` flag was misleading
- `rollbackOnError` didn't work for destructive ops

---

## Migration Paths

Choose the pattern that matches your use case:

### Pattern A: Your Data is Cached/Ephemeral

**Best for:** API caches, offline queues, session storage

```typescript
// ✅ v0.5.0 - Simple reconnect
async function connectDB() {
  try {
    return await DexBee.connect('myapp', schema)
  } catch (error) {
    // Schema changed? Clear and rebuild
    await DexBee.delete('myapp')
    return await DexBee.connect('myapp', schema)
  }
}
```

**When to use:**
- Data can be re-fetched from server
- Losing cached data is acceptable
- Simple, no migration code needed

---

### Pattern B: You Only Add New Fields/Tables

**Best for:** Stable schemas with gradual additions

```typescript
// ✅ v0.5.0 - Safe additive migrations (still work!)
import { withMigrations } from 'dexbee-js/migrations'

const newSchema = {
  version: 2,
  tables: {
    users: {
      schema: {
        // Existing fields
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        // NEW: Added fields (safe!)
        avatar: { type: 'string' },
        createdAt: { type: 'date', default: () => new Date() }
      }
    },
    // NEW: Added table (safe!)
    sessions: { /* ... */ }
  }
}

const migratable = withMigrations(db)
await migratable.migrate(newSchema)  // Works perfectly, no data loss
```

**When to use:**
- You never remove/rename fields
- You never remove tables
- Schema only grows
- DexBee migrations handle this perfectly

---

### Pattern C: You Need Manual Backup for Critical Data

**Best for:** Offline-first apps, user-generated content

**Replace this:**
```typescript
// ❌ v0.4.x - False security
await migratable.migrate(newSchema, {
  createBackup: true,       // Didn't actually create backup
  rollbackOnError: true     // Didn't actually rollback
})
```

**With this:**
```typescript
// ✅ v0.5.0 - Real backup
import { withMigrations } from 'dexbee-js/migrations'

async function exportDatabase(db: Database): Promise<any> {
  const backup: any = { tables: {} }
  const tableNames = Object.keys(db.getSchema().tables)
  
  for (const tableName of tableNames) {
    backup.tables[tableName] = await db.table(tableName).all()
  }
  
  return backup
}

async function importDatabase(db: Database, backup: any): Promise<void> {
  for (const [tableName, records] of Object.entries(backup.tables)) {
    const table = db.table(tableName)
    await table.clear()
    for (const record of records as any[]) {
      await table.insert(record)
    }
  }
}

// Migration with real backup
const migratable = withMigrations(db)
const dryRun = await migratable.dryRunMigration(newSchema)

if (dryRun.warnings.length > 0) {
  // Create REAL backup
  const backup = await exportDatabase(db)
  localStorage.setItem('db-backup', JSON.stringify(backup))
  
  // Or download as file
  downloadJSON(backup, `backup-${Date.now()}.json`)
}

try {
  await migratable.migrate(newSchema)
  localStorage.removeItem('db-backup')  // Success, clear backup
} catch (error) {
  // Restore from backup
  const backup = JSON.parse(localStorage.getItem('db-backup')!)
  await importDatabase(db, backup)
  throw error
}
```

**When to use:**
- Critical user data that can't be recreated
- Destructive schema changes needed
- Want real data protection

---

### Pattern D: Versioned Database Names

**Best for:** Apps that need gradual migration or rollback capability

**Replace this:**
```typescript
// ❌ v0.4.x - Rollback didn't work
await migratable.migrate(newSchema)
await migratable.rollback(1)  // Failed for destructive changes
```

**With this:**
```typescript
// ✅ v0.5.0 - Real rollback via separate databases
const DB_VERSION = 'v3'
const db = await DexBee.connect(`myapp-${DB_VERSION}`, schema)

// Rollback = just change DB_VERSION back to 'v2' and redeploy
// Migration = copy data from old DB to new DB
```

**When to use:**
- Need true rollback capability
- Want to test new schema before committing
- Enterprise apps with strict data requirements

---

## API Changes Summary

### Removed from `MigrationOptions`

```typescript
interface MigrationOptions {
  dryRun?: boolean              // ✅ Still available
  validateEachStep?: boolean    // ✅ Still available
  batchSize?: number           // ✅ Still available
  
  createBackup?: boolean        // ❌ REMOVED
  rollbackOnError?: boolean     // ❌ REMOVED
}
```

### Removed from `MigratableDatabase`

```typescript
interface MigratableDatabase<T> extends Database<T> {
  migrate(schema, options?)         // ✅ Still available
  dryRunMigration(schema, options?) // ✅ Still available
  getMigrationStatus()              // ✅ Still available
  
  rollback(targetVersion)           // ❌ REMOVED
}
```

### Removed from `MigrationResult`

```typescript
interface MigrationResult {
  success: boolean              // ✅ Still available
  version: number              // ✅ Still available
  operationsExecuted: number   // ✅ Still available
  duration: number             // ✅ Still available
  errors?: Error[]             // ✅ Still available
  
  backupCreated?: boolean      // ❌ REMOVED
}
```

---

## What Still Works

### ✅ Dry Run (Your Real Safety Mechanism)

```typescript
const migratable = withMigrations(db)
const dryRun = await migratable.dryRunMigration(newSchema)

console.log('Valid:', dryRun.isValid)
console.log('Operations:', dryRun.operations)
console.log('Warnings:', dryRun.warnings)

// Make informed decision based on real information
if (dryRun.warnings.includes('destructive')) {
  // Handle carefully - create backup, ask user, etc.
}
```

### ✅ Automatic Migration Generation

```typescript
// DexBee still automatically detects:
// - Added tables
// - Removed tables
// - Added fields
// - Removed fields
// - Modified fields
// - Added indexes
// - Removed indexes

// And generates the right operations
```

### ✅ Migration History

```typescript
const status = await migratable.getMigrationStatus()
console.log('Current version:', status.currentVersion)
console.log('Migration history:', status.migrationHistory)
```

---

## Decision Tree

```
Is your data disposable/re-syncable?
├─ YES → Pattern A: Clear and rebuild
└─ NO → Do you only add fields/tables (never remove)?
    ├─ YES → Pattern B: Use DexBee migrations (automatic!)
    └─ NO → Do you have critical user data?
        ├─ YES → Pattern C: Manual backup before migration
        └─ NO → Pattern D: Versioned database names
```

---

## FAQ

### Q: Why remove these features?

**A:** They didn't actually work. The backup option did nothing, and rollback only worked for simple additive operations. Removing them forces users to implement real backup strategies instead of relying on fake ones.

### Q: I was using `createBackup: true` - what happens?

**A:** It was doing nothing. You need to implement real backups using Pattern C above.

### Q: Can I still migrate schemas?

**A:** Yes! DexBee migrations still work perfectly for:
- Adding new tables
- Adding new fields
- Adding new indexes
- Modifying field types (with care)

The automatic migration generation is unchanged.

### Q: What about data transformations?

**A:** Still supported via `transformData` operations, but you're now responsible for backups if things go wrong.

### Q: Is there any way to rollback?

**A:** Use Pattern D (versioned database names) for true rollback capability, or Pattern C (manual backups) for data restoration.

### Q: Should I still use migrations?

**A:** Yes, if your schema changes frequently or you have multiple tables. No, if your data is just a cache.

---

## Bundle Size Impact

- **v0.4.x:** 24KB migration bundle
- **v0.5.0:** ~13KB migration bundle (**46% smaller!**)

---

## Timeline

- **v0.4.0:** Deprecation warnings added
- **v0.5.0:** Features removed (current)
- **v0.6.0+:** Simplified migration system stable

---

## Need Help?

File an issue: https://github.com/AhamSammich/dexbee-js/issues

Include:
- Your use case
- Current schema
- Target schema
- Which pattern you're considering
