# Migration System

DexBee provides an enterprise-grade migration system for evolving your database schema safely.

## Installation

The migration system is included in `dexbee-js` but imported separately to keep your bundle size minimal:

```typescript
import { DexBee } from 'dexbee-js'              // Core: ~34KB
import { withMigrations } from 'dexbee-js/migrations'  // Migrations: +22KB
```

## When to Use Migrations

### ✅ Use migrations if:
- Your app has 5+ tables
- Schema changes frequently
- You have real user data to protect
- Multiple developers work on the schema

### ❌ Skip migrations if:
- Simple app with 1-3 stable tables
- Data is disposable/re-syncable from server
- You prefer explicit control

## Quick Start

```typescript
import { DexBee, defineSchema } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

// 1. Connect to database
const db = await DexBee.connect('myapp', currentSchema)

// 2. Add migration capabilities
const migratable = withMigrations(db)

// 3. Preview migration
const dryRun = await migratable.dryRunMigration(newSchema)
console.log('Operations:', dryRun.operations)
console.log('Warnings:', dryRun.warnings)

// 4. Apply migration with safety
if (dryRun.isValid) {
  const result = await migratable.migrate(newSchema, {
    createBackup: true,
    rollbackOnError: true
  })
  console.log(`Migrated ${result.operationsExecuted} operations`)
}
```

## API Reference

### `withMigrations(database)`

Augments a Database instance with migration methods.

**Parameters:**
- `database: Database` - The database instance to augment

**Returns:** `MigratableDatabase` - Database with migration capabilities

**Example:**
```typescript
const db = await DexBee.connect('mydb', schema)
const migratable = withMigrations(db)
```

### `migrate(newSchema, options?)`

Apply a migration to transform the schema.

**Parameters:**
- `newSchema: DatabaseSchema` - The target schema to migrate to
- `options?: MigrationOptions` - Migration options

**Options:**
- `dryRun: boolean` – Test migration without applying
- `createBackup: boolean` – Backup data before migration
- `rollbackOnError: boolean` – Auto-rollback on failure
- `validateEachStep: boolean` – Validate after each operation

**Returns:** `Promise<MigrationResult>` - Migration result with success status

**Example:**
```typescript
const result = await migratable.migrate(newSchema, {
  createBackup: true,
  rollbackOnError: true,
  validateEachStep: true
})

if (result.success) {
  console.log(`Migration completed: ${result.operationsExecuted} operations in ${result.duration}ms`)
} else {
  console.error('Migration failed:', result.errors)
}
```

### `dryRunMigration(newSchema, options?)`

Preview what a migration will do without applying changes.

**Parameters:**
- `newSchema: DatabaseSchema` - The target schema to analyze
- `options?: MigrationOptions` - Migration options

**Returns:** `Promise<DryRunResult>` - Dry run result with validation and warnings

**Example:**
```typescript
const dryRun = await migratable.dryRunMigration(newSchema)

console.log('Valid:', dryRun.isValid)
console.log('Operations:', dryRun.operations.length)
console.log('Warnings:', dryRun.warnings)
console.log('Errors:', dryRun.errors)

if (!dryRun.isValid) {
  console.error('Migration validation failed:', dryRun.errors)
  return
}

if (dryRun.warnings.length > 0) {
  console.warn('Migration has warnings:', dryRun.warnings)
}

// Apply migration if valid
await migratable.migrate(newSchema)
```

### `rollback(targetVersion, options?)`

Rollback to a previous schema version.

**Parameters:**
- `targetVersion: number` - The version to rollback to
- `options?: RollbackOptions` - Rollback options

**Returns:** `Promise<RollbackResult>` - Rollback result

**Example:**
```typescript
const result = await migratable.rollback(1)
console.log(`Rolled back ${result.operationsRolledBack} operations`)
```

### `getMigrationStatus()`

Get current migration version and history.

**Returns:** `Promise<MigrationStatus>` - Current migration status

**Example:**
```typescript
const status = await migratable.getMigrationStatus()
console.log(`Current version: ${status.currentVersion}`)
console.log(`Up to date: ${status.isUpToDate}`)
console.log(`Pending migrations: ${status.pendingMigrations.length}`)
```

## Common Migration Scenarios

### Adding a New Field

```typescript
const v2Schema = defineSchema({
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: false, default: '' }, // New field
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
})

const migratable = withMigrations(db)
await migratable.migrate(v2Schema)
```

### Adding a New Table

```typescript
const v2Schema = defineSchema({
  version: 2,
  tables: {
    users: { /* existing table */ },
    posts: { // New table
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        authorId: { type: 'number', required: true },
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
})

await migratable.migrate(v2Schema)
```

### Renaming a Field (with data transformation)

```typescript
// Note: This requires closing and reopening the database with the new schema
// Migration will handle data transformation automatically
const v2Schema = defineSchema({
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        firstName: { type: 'string', required: true }, // Renamed from 'name'
        lastName: { type: 'string', required: true },  // New field
      },
      primaryKey: 'id',
      autoIncrement: true,
    },
  },
})

// Data transformation would be handled by dropping old field and adding new ones
```

### Safe Migration Workflow

```typescript
// 1. Define new schema
const newSchema = defineSchema({ /* ... */ })

// 2. Always do a dry run first
const dryRun = await migratable.dryRunMigration(newSchema)

// 3. Check for errors
if (!dryRun.isValid) {
  console.error('Migration validation failed:', dryRun.errors)
  return
}

// 4. Review warnings
if (dryRun.warnings.length > 0) {
  console.warn('Migration warnings:', dryRun.warnings)
  // Decide if you want to proceed
}

// 5. Check for destructive operations
const hasDestructive = dryRun.operations.some(op =>
  ['dropTable', 'dropField', 'alterField'].includes(op.type)
)

if (hasDestructive) {
  console.warn('Migration includes destructive operations!')
  // Perhaps require user confirmation
}

// 6. Apply migration with safety options
const result = await migratable.migrate(newSchema, {
  createBackup: true,      // Create backup before migration
  rollbackOnError: true,   // Auto-rollback if anything fails
  validateEachStep: true,  // Validate after each operation
})

if (result.success) {
  console.log('Migration successful!')
} else {
  console.error('Migration failed:', result.errors)
}
```

## Bundle Size Impact

The migration system is designed to be tree-shakeable, so you only pay for what you use:

| Import Pattern | Bundle Size (gzipped) | Use Case |
|----------------|----------------------|----------|
| Core only | ~34KB | Apps without migrations |
| With migrations | ~56KB | Apps using schema evolution |

```typescript
// Core only (~34KB) - No migration imports
import { DexBee, eq, and } from 'dexbee-js'

// With migrations (~56KB) - When you need schema evolution
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'
```

## Best Practices

### 1. Always Test Migrations First

```typescript
// Always do a dry run before applying migrations
const dryRun = await migratable.dryRunMigration(newSchema)
if (!dryRun.isValid) {
  console.error('Migration invalid:', dryRun.errors)
  return
}
```

### 2. Use Incremental Version Numbers

```typescript
// Good: Increment version by 1
const v1Schema = { version: 1, /* ... */ }
const v2Schema = { version: 2, /* ... */ }
const v3Schema = { version: 3, /* ... */ }

// Avoid: Skipping versions
const v1Schema = { version: 1, /* ... */ }
const v3Schema = { version: 3, /* ... */ } // ❌ Skipped version 2
```

### 3. Always Enable Safety Options

```typescript
// Always use safety options for production migrations
await migratable.migrate(newSchema, {
  createBackup: true,
  rollbackOnError: true,
  validateEachStep: true,
})
```

### 4. Handle Migration Errors

```typescript
try {
  const result = await migratable.migrate(newSchema, {
    rollbackOnError: true,
  })

  if (!result.success) {
    // Migration failed but was rolled back
    console.error('Migration failed:', result.errors)
    // Notify user or log to analytics
  }
} catch (error) {
  // Critical failure
  console.error('Migration crashed:', error)
  // Handle appropriately
}
```

### 5. Check Migration Status

```typescript
const status = await migratable.getMigrationStatus()
console.log(`Current version: ${status.currentVersion}`)

if (!status.isUpToDate) {
  console.log('Migrations pending:', status.pendingMigrations)
}
```

## Advanced Usage

### Custom Migration Operations

For advanced scenarios, you can use the migration system internals directly:

```typescript
import {
  MigrationManager,
  SchemaDiffEngine,
  AddTableOperation,
  DataTransformer
} from 'dexbee-js/migrations'

// Create custom migration logic
const manager = new MigrationManager(db, 'mydb')
const diffEngine = new SchemaDiffEngine()

// Generate custom migration plan
const plan = await manager.generateMigration(oldSchema, newSchema)

// Apply with custom options
await manager.applyMigration(plan, {
  batchSize: 100,
  validateEachStep: true,
})
```

## Troubleshooting

### Migration Validation Fails

If your migration fails validation:

1. Check the error messages in `dryRun.errors`
2. Ensure version numbers are incremental
3. Verify all required fields have defaults or are nullable
4. Check for conflicting schema changes

### Data Loss Warnings

If you see data loss warnings:

1. Review the operations that will drop tables or fields
2. Consider adding data transformation steps
3. Always use `createBackup: true` option
4. Test migrations on a copy of your data first

### Performance Issues

If migrations are slow:

1. Use `batchSize` option to process data in chunks
2. Consider doing migrations during low-traffic periods
3. Test migration duration with `dryRun.estimatedDuration`
4. Break large migrations into smaller incremental changes

## Migration Limitations

Current limitations of the migration system:

1. **Schema Version Changes**: Migrations that change the database version require a full database connection cycle
2. **Complex Transformations**: Some complex data transformations may need to be done manually
3. **Rollback Limitations**: Not all operations can be automatically rolled back (e.g., dropped data)
4. **Concurrent Migrations**: Only one migration can run at a time per database

## See Also

- [Schema Definition Guide](./schema-design.md)
- [Type Safety Guide](./type-safety.md)
- [Best Practices](./best-practices.md)
