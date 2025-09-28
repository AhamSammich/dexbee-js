# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DexBee is a TypeScript IndexedDB ORM library that provides SQL-like query builder functionality for browser-based applications. The project is currently in Phase 4.1 complete, with enterprise-grade migration system implemented.

## Development Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Build with tsup (ESM + UMD + types, browser-optimized)
- `pnpm build:watch` - Watch mode build with tsup
- `pnpm dev` - Watch mode build (alias for build:watch)
- `pnpm test` - Run tests with Vitest
- `pnpm test:ui` - Run tests with UI
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:tree-shaking` - Test tree-shaking functionality
- `pnpm lint` - Lint TypeScript files
- `pnpm format` - Format code with Prettier

## Project Structure

```
src/
├── core/                    # Core infrastructure classes
│   ├── database-manager.ts  # IndexedDB connection management
│   ├── schema-manager.ts    # Schema validation and migrations
│   ├── transaction-manager.ts # Transaction coordination
│   ├── transaction-wrapper.ts # Individual transaction wrapper
│   ├── database.ts         # Main Database class
│   ├── migration-manager.ts # Migration orchestration
│   ├── migration-history.ts # Migration tracking
│   ├── schema-diff-engine.ts # Schema comparison and diff generation
│   └── interfaces.ts       # Core interfaces
├── query/                  # SQL-like query system
│   ├── query-builder.ts    # Fluent query builder
│   ├── query-executor.ts   # Query execution engine
│   ├── table.ts           # Table operations with query interface
│   ├── operators.ts       # SQL-like operators (eq, gt, and, or)
│   └── interfaces.ts      # Query interfaces
├── migration/              # Enterprise migration system
│   ├── operations/        # Individual migration operations
│   │   ├── add-table-operation.ts
│   │   ├── drop-table-operation.ts
│   │   ├── add-field-operation.ts
│   │   ├── drop-field-operation.ts
│   │   ├── alter-field-operation.ts
│   │   ├── add-index-operation.ts
│   │   └── transform-data-operation.ts
│   ├── data-transformer.ts # Data transformation utilities
│   └── safety/            # Migration safety and validation
│       └── migration-validator.ts
├── types/                 # Type definitions
│   ├── schema.ts         # Schema and table definitions
│   ├── transaction.ts    # Transaction types
│   ├── migration.ts      # Migration types and interfaces
│   ├── query.ts          # Query types
│   └── errors.ts         # Error types and classes
└── index.ts              # Public API exports (tree-shaking optimized)

tests/integration/        # Integration tests using fake-indexeddb
docs/                    # Architecture and implementation docs
```

## Architecture

DexBee implements a layered architecture with enterprise-grade capabilities:

### Core Layer
1. **DatabaseManager**: Handles IndexedDB connections, version management, and schema upgrades
2. **SchemaManager**: Validates schemas, applies defaults, and manages data validation
3. **TransactionManager**: Provides Promise-based transaction abstraction with automatic lifecycle management

### Query Layer
4. **QueryBuilder**: SQL-like fluent interface for building complex queries
5. **QueryExecutor**: Optimized query execution with index usage and relationship loading
6. **Table**: High-level table interface combining CRUD operations with query capabilities

### Migration Layer (Enterprise Feature)
7. **MigrationManager**: Orchestrates schema evolution with safety guarantees
8. **SchemaDiffEngine**: Analyzes schema differences and generates migration operations
9. **Migration Operations**: Atomic, reversible operations (add/drop tables, fields, indexes, data transformations)
10. **DataTransformer**: Handles complex data transformations during migrations
11. **Migration Safety**: Comprehensive validation, rollback capabilities, and dry-run support

## Testing

The project uses Vitest with fake-indexeddb for testing. All tests are integration tests that verify real IndexedDB behavior:

- 107 passing integration tests
- Tests cover all core functionality, query operations, aggregations, relationships, and migrations
- Uses fake-indexeddb to simulate browser IndexedDB behavior
- Migration system has 16 comprehensive integration tests

### Running Specific Tests
- `pnpm test tests/integration/migration.test.ts` - Run migration tests only
- `pnpm test tests/integration/query-builder.test.ts` - Run query builder tests only
- `pnpm test --ui` - Interactive test UI for debugging

## Current Status: Phase 4.1 Complete ✅

**Implemented:**
- ✅ Complete database connection and transaction management
- ✅ Advanced SQL-like query builder with relationships and aggregations
- ✅ Enterprise-grade schema migration system with rollback support
- ✅ Comprehensive data transformation capabilities
- ✅ Tree-shaking optimized build (25% bundle reduction for core-only usage)
- ✅ Type-safe interfaces throughout with strict TypeScript
- ✅ Production-ready error handling and validation

**Build Output (Tree-Shaking Optimized):**
- `dist/index.js` - ESM build (50KB main bundle + tree-shakeable chunks)
- `dist/index.umd.js` - UMD build (70KB, script tag usage)
- `dist/index.d.ts` - TypeScript declarations
- Code splitting: Migration operations split into separate chunks
- **Tree-shaking**: Core-only usage ~45KB, Query-only ~35KB
- **Browser-focused**: No CJS (IndexedDB is browser-only)

## Tree-Shaking and Performance

DexBee is optimized for tree-shaking with `"sideEffects": false`. The exports are organized into logical groups:

- **Core API**: Essential database operations
- **Query System**: SQL-like builders and operators
- **Migration System**: Enterprise schema evolution (tree-shakeable)
- **Type Definitions**: All types are tree-shakeable

### Usage Patterns for Optimal Bundle Size:
```typescript
// Core-only usage (~45KB): Basic database operations
import { DexBee, eq, and } from 'dexbee';

// Query-heavy usage (~35KB): Advanced querying without migrations
import { QueryBuilder, Table, eq, gt, between, and, or } from 'dexbee';

// Enterprise usage (~67KB): Full features including migrations
import { DexBee, MigrationManager, SchemaDiffEngine, eq, and } from 'dexbee';
```

## Key Features and Usage Patterns

### Basic Database Operations
```typescript
import { DexBee, eq, and, gt } from 'dexbee';

const schema = {
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
      autoIncrement: true
    }
  }
};

const db = await DexBee.connect('my-app', schema);

// High-level Table API with SQL-like queries
const users = db.table('users');
await users.insert({ name: 'John', email: 'john@example.com', age: 30 });
const adults = await users.where(gt('age', 18)).all();
const user = await users.where(eq('email', 'john@example.com')).first();
```

### Advanced Querying with Relationships
```typescript
// Complex queries with relationships, aggregations, and joins
const posts = await db.table('posts')
  .where(and(eq('status', 'published'), gt('views', 100)))
  .include('author', { select: ['name', 'email'] })
  .include('comments', {
    where: eq('approved', true),
    orderBy: [{ field: 'createdAt', direction: 'desc' }]
  })
  .orderBy('publishedAt', 'desc')
  .limit(10)
  .all();

// Aggregations
const stats = await db.table('users')
  .where(gt('age', 18))
  .groupBy('department')
  .having(gt('_count', 5))
  .aggregate('avg', 'salary');
```

### Enterprise Schema Migrations
```typescript
import { DexBee, MigrationManager } from 'dexbee';

// Automatic migration generation and application
const newSchema = {
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        firstName: { type: 'string', required: true }, // Split name field
        lastName: { type: 'string', required: true },
        email: { type: 'string', unique: true },
        age: { type: 'number' },
        department: { type: 'string' } // New field
      },
      primaryKey: 'id',
      autoIncrement: true
    },
    posts: { // New table
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        authorId: { type: 'number', required: true }
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
};

// Dry run to validate migration safety
const dryRun = await db.dryRunMigration(newSchema);
if (dryRun.isValid) {
  // Apply migration with automatic rollback on error
  const result = await db.migrate(newSchema, {
    createBackup: true,
    rollbackOnError: true
  });
  console.log(`Migration completed: ${result.operationsExecuted} operations`);
}
```

## Development Guidelines

### Code Organization
- **Core classes** are in `src/core/` - these handle fundamental database operations
- **Query system** is in `src/query/` - SQL-like interface and execution
- **Migration system** is in `src/migration/` - enterprise schema evolution
- **Types** are in `src/types/` - comprehensive TypeScript definitions
- **Tests** are integration-focused and use `fake-indexeddb` for realistic IndexedDB simulation

### TypeScript Configuration
The project uses strict TypeScript with:
- ES2020 target for modern browser compatibility
- ESNext modules for optimal tree-shaking
- Strict mode with comprehensive type checking
- DOM types for IndexedDB APIs

### Error Handling
All operations use the `DexBeeError` system with specific error codes:
- `CONNECTION_FAILED` - Database connection issues
- `SCHEMA_VALIDATION_FAILED` - Schema or data validation errors
- `TRANSACTION_FAILED` - Transaction execution problems
- `MIGRATION_*` errors - Migration-specific issues

### Testing Strategy
- Integration tests that simulate real IndexedDB behavior
- Each major feature has comprehensive test coverage
- Migration tests include safety validation and rollback scenarios
- Use `pnpm test --ui` for interactive debugging
- Run specific test files for focused development

## Next Development Areas

Based on the documentation in `docs/`, potential next phases include:
- **@dexbee/sync**: Local-first synchronization with backend services
- **Performance optimizations**: Further bundle size reductions and query performance
- **Advanced indexing**: Compound indexes and full-text search capabilities
- **Real-time features**: Live queries and reactive data patterns