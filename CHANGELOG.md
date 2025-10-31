# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-10-31

### Added
- **Async Operation Queue**: Automatic race condition prevention for concurrent database operations
  - Per-record operation queuing to ensure sequential execution for the same record
  - Parallel execution for different records across multiple concurrent operations
  - Configurable via `TableOptions.queueOperations` (enabled by default)
  - New `OperationQueue` class in `src/core/operation-queue.ts`
  - Comprehensive integration tests for operation queue behavior
  - Enhanced examples to work with fake-indexeddb for Node.js testing

- **Migration System Documentation**: Comprehensive documentation rewrite with practical patterns
  - 4 documented migration patterns with decision tree (Cache-First, Additive-Only, Manual Backup, Versioned DBs)
  - Clear guidance on when to use migrations vs. alternative approaches
  - Pattern examples for common use cases (API caches, offline-first apps, user data)
  - Honest documentation about migration capabilities and limitations
  - See `docs/migrations.md` for complete migration guide

### Changed
- **Migration System Simplification**: Removed non-functional features to provide honest, working capabilities
  - Migration system focused on safe, automatic schema evolution
  - Dry run validation (`dryRunMigration()`) is now the primary safety mechanism
  - Bundle size reduced from 24KB to 17KB (-29% reduction)
  - All working features (migrate, dryRun, status) remain unchanged

### Removed
- **BREAKING**: Removed non-functional migration features that provided false security:
  - Removed `rollback()` method - only worked for simple additive operations, failed for destructive changes
  - Removed `createBackup` option from `MigrationOptions` - was not implemented (just a comment)
  - Removed `rollbackOnError` option from `MigrationOptions` - didn't work for destructive operations
  - Removed `backupCreated` field from `MigrationResult` - always returned true without creating backup
  - Removed `MigrationHistoryManager` class and migration history tracking
  - Removed rollback methods from all migration operation classes
- **BREAKING**: Removed incomplete data transformation features:
  - Removed `DataTransformer` class - stub implementation with no actual functionality
  - Removed `TransformDataOperation` class - depended on non-functional DataTransformer
  - Removed `DataTransformation` type from migration types
  - Removed `TransformOptions`, `TransformResult`, `BatchTransformOptions`, `TableTransformation`, and `BatchTransformResult` types
  - Removed `transformData` from `MigrationOperationType` union

### Migration Guide
**For users upgrading from v0.3.x:**

Before (removed features):
```typescript
const result = await migratable.migrate(newSchema, {
  createBackup: true,      // ❌ Did nothing
  rollbackOnError: true    // ❌ Didn't work for destructive ops
})
await migratable.rollback(1) // ❌ Failed for destructive changes
```

After (simplified, working approach):
```typescript
// Preview first (shows exactly what will happen)
const dryRun = await migratable.dryRunMigration(newSchema)
console.log('Operations:', dryRun.operations)
console.log('Warnings:', dryRun.warnings)

// Apply if safe
if (dryRun.isValid && dryRun.warnings.length === 0) {
  await migratable.migrate(newSchema, {
    validateEachStep: true  // Only valid option
  })
}
```

**For critical data protection**, see the Manual Backup pattern in `docs/migrations.md` which provides real backup functionality.

**For true rollback capability**, see the Versioned Database Names pattern in `docs/migrations.md`.

**If you were using TransformDataOperation:**
```typescript
// ❌ Before (doesn't work anyway - it's a stub)
import { TransformDataOperation } from 'dexbee-js/migrations'
const op = new TransformDataOperation('users', {
  transform: (record) => ({ ...record, processed: true })
})

// ✅ After - Handle data transformation manually
const db = await DexBee.connect('mydb', newSchema)
const users = db.table('users')
const allRecords = await users.all()
const transformed = allRecords.map(record => ({ ...record, processed: true }))
for (const record of transformed) {
  await users.update(record.id, record)
}
```

## [0.3.1] - 2025-10-23

### Added
- **Server-side Testing Example**: New `node-testing-example.ts` demonstrating practical server-side use cases
- **Comprehensive Test Coverage**: Significantly improved test coverage for core modules
  - **MigrationHistoryManager Tests**: 91.12% coverage with 20 test cases covering migration recording, retrieval, validation, and error handling
  - **SchemaDiffEngine Tests**: 87.61% coverage with 20 test cases covering schema diff generation, migration operation creation, safety validation, and complexity estimation
  - **MigrationManager Tests**: 69.23% coverage with 11 test cases covering migration plan generation, dry runs, application, and status retrieval
  - Overall `src/core` coverage improved from 54.2% to 70.37% (+16.17% improvement)

### Documentation
- **Cross-runtime Compatibility**: Confirmed and documented server-side support
  - **Node.js Support**: Works with `fake-indexeddb` polyfill for memory-only storage
  - **Deno Support**: Compatible via `npm:` specifier (Deno v2+)
  - **Bun Support**: Compatible with ESM support (Bun v1.2.9+)
  - Added comprehensive documentation for server-side usage patterns
  - Added runtime compatibility matrix with clear version requirements
  - Updated JSR package configuration to reflect multi-runtime support

## [0.3.0] - 2025-10-23

### Added
- **Full Type Inference System**: Complete TypeScript type safety for database operations
  - New `defineSchema()` helper function that eliminates the need for `as const` assertions
  - Generic `Database<TSchema>` class that provides fully typed table instances
  - Comprehensive type inference utilities in `src/types/infer.ts`:
    - `InferTableType`: Infers TypeScript types from schema definitions
    - `InferDatabaseTables`: Maps all table names to their inferred types
    - `InsertType`: Makes auto-increment primary keys optional based on schema metadata
    - `ExpandRecursively`: Utility type that preserves built-in types (Date, Blob, etc.)
  - New `typed-schema-demo.ts` example demonstrating full type safety
  - All CRUD operations are now type-checked at compile time
  - Type-safe select and where clause operations

### Changed
- Database class is now generic (`Database<TSchema>`) to support typed instances
- Table operations now return fully typed results based on schema definitions

## [0.2.0] - 2025-10-01

### Added
- **Blob Storage Support**: Comprehensive support for storing and managing binary data (Files, Blobs)
  - New `blob` field type in schema definitions
  - `insertWithBlob()`, `updateBlob()`, `getBlobUrl()`, and `getBlobMetadata()` methods on Table
  - Blob-specific query operators: `sizeGt`, `sizeLt`, `sizeBetween`, `mimeType`
  - Enhanced reliability for blob storage operations

### Fixed
- Updated repository URL format for npm provenance verification

### Documentation
- Added comprehensive JSDoc documentation throughout the API

## [0.1.3] - 2025-10-01

### Added
- **Query System Enhancements**:
  - New `inArray()` operator for IN queries (recommended replacement for `in_`)
  - Comprehensive test coverage for all query operators
  - Enhanced query builder documentation

### Changed
- **Deprecated Operators**:
  - `in_` operator deprecated in favor of `inArray` for better developer experience
  - `notIn` operator deprecated in favor of composable `not(inArray(...))` pattern

### Documentation
- Added comprehensive JSDoc documentation to QueryBuilder and QueryExecutor
- Added extensive JSDoc documentation for all query operators

### Maintenance
- Linting improvements and code quality enhancements

## [0.1.2] - 2025-09-29

### Fixed
- Fixed JSR.json synchronization after version updates
- Ensured version consistency across package files

### Documentation
- Enhanced JSDoc documentation for JSR (JavaScript Registry) compliance
- Improved API documentation quality

## [0.1.1] - 2025-09-29

### Added
- Initial public release
- Core database connection and transaction management
- SQL-like query builder with chainable interface
- Schema validation and data integrity
- Enterprise-grade migration system with rollback support
- Type-safe TypeScript interfaces throughout
- Tree-shaking optimized build (~14KB gzipped)
- Comprehensive test suite with fake-indexeddb

### Features
- **Database Management**: Connection lifecycle, schema validation, version management
- **Query System**: SQL-like operators (eq, gt, gte, lt, lte, between, in_, not, and, or)
- **Transaction Management**: Promise-based API with automatic lifecycle handling
- **Migration System**: Automatic schema evolution, dry-run validation, rollback support
- **Type Safety**: Full TypeScript support with strict type checking

[0.2.0]: https://github.com/AhamSammich/dexbee-js/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/AhamSammich/dexbee-js/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/AhamSammich/dexbee-js/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AhamSammich/dexbee-js/releases/tag/v0.1.1
