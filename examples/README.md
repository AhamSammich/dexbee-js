# DexBee Usage Examples

This directory contains examples demonstrating different ways to use DexBee.

## Examples

### 1. Query Builder Demo (`query-builder-demo.ts`)
Comprehensive demonstration of the SQL-like query interface:
- Fluent query chaining: `select().where().orderBy().limit()`
- Type-safe field selection with IntelliSense
- Comparison operators: `eq`, `gt`, `lt`, `gte`, `lte`, `between`, `in`, `notIn`
- Logical operators: `and`, `or`, `not`
- Execution methods: `all()`, `first()`, `count()`
- Complete CRUD operations
- Multi-table operations

**Run with:**
```bash
pnpm tsx examples/query-builder-demo.ts
```

### 2. Typed Schema Demo (`typed-schema-demo.ts`)
Demonstrates fully typed schema definitions with automatic TypeScript inference:
- Complete type safety similar to Supabase/Drizzle
- Type-checked table names, fields, and operations
- Automatic type inference from schema
- Type-narrowing with `select()`
- Compile-time validation of insert/update operations

**Key features:**
- Use `defineSchema()` helper for automatic type inference (no `as const` needed!)
- Fully typed `db.table()` methods
- TypeScript validates required fields
- Type-safe relationship handling

**Run with:**
```bash
pnpm tsx examples/typed-schema-demo.ts
```

### 3. Script Tag Usage (`script-tag-usage.html`)
Shows how to use DexBee directly in the browser via script tag (UMD build):
- No build tools required
- Global `DexBee` object available
- Direct IndexedDB operations in the browser

Open in browser to test the UMD build.

### 4. Node.js Testing Example (`node-testing-example.ts`)
Demonstrates practical Node.js use cases for DexBee with fake-indexeddb:
- Database schema testing and migration planning
- Query logic validation for CI/CD pipelines
- Data validation and error handling testing
- Performance testing of database operations
- Prototyping database designs before browser implementation

**Prerequisites:**
```bash
npm install fake-indexeddb
```

**Run with:**
```bash
npx tsx examples/node-testing-example.ts
```

**Use cases:**
- Testing database schemas and migrations
- Validating query logic in CI/CD pipelines
- Performance testing database operations
- Prototyping database designs before browser implementation
- Unit testing database logic without browser dependencies

**⚠️ Limitations:**
- Memory-only (data lost on process exit)
- Blob/File storage has limitations
- Transaction testing has fake-indexeddb limitations
- Not suitable for production data persistence

### 5. Todo List Demo (`todo-list-demo.html`)
Comprehensive todo list application demonstrating real-world DexBee usage:
- Complete CRUD operations (Create, Read, Update, Delete)
- SQL-like query operations with filtering
- Schema definition with indexes
- Transaction management
- Real-time UI updates
- Modern, responsive design

**Features showcased:**
- Database connection and initialization
- Table operations with query builder
- Data validation and error handling
- Index usage for optimized queries
- Browser-based IndexedDB operations

Open `todo-list-demo.html` in your browser for a fully functional demo app.

## Installation Methods

### ESM (Recommended for bundlers)
```typescript
import { DatabaseSchema, DexBee } from 'dexbee'
```

### UMD (Script tag usage)
```html
<script src="https://unpkg.com/dexbee/dist/index.umd.js"></script>
<script>
  // DexBee is now available globally
  const { DexBee, Database, DexBeeError } = window.DexBee;
</script>
```

### CDN Links
- **unpkg**: `https://unpkg.com/dexbee/dist/index.umd.js`
- **jsdelivr**: `https://cdn.jsdelivr.net/npm/dexbee/dist/index.umd.js`
