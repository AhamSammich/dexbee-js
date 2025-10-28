# DexBee 🐝

A modern TypeScript IndexedDB ORM with SQL-like query builder interface. Build powerful browser-based applications with type-safe database operations and automatic schema migrations.

[![CI](https://github.com/AhamSammich/dexbee-js/actions/workflows/ci.yml/badge.svg)](https://github.com/AhamSammich/dexbee-js/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/dexbee-js.svg)](https://badge.fury.io/js/dexbee-js)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎯 **Type-safe** - Full TypeScript support with strong typing
- 🔍 **SQL-like queries** - Familiar syntax for database operations
- 🚀 **Tree-shakeable** - Import only what you need for optimal bundle size
- 📦 **Schema migrations** - Automatic database schema evolution
- 🔄 **Transaction support** - ACID compliance with transaction wrapper
- ⚡ **Operation queuing** - Automatic race condition prevention for concurrent operations
- 🌐 **Modern ESM** - Full ESM support with TypeScript declarations
- 🎨 **Query builder** - Intuitive, chainable query interface
- 🌍 **Browser-focused** - Built specifically for IndexedDB in browser environments
- 📎 **Blob storage** - Native support for Files, Blobs, and binary data with streaming
- 🧪 **Comprehensive testing** - Unit tests, browser integration tests, and manual testing tools

## 📦 Installation

```bash
npm install dexbee-js
```

```bash
pnpm add dexbee-js
```

```bash
yarn add dexbee-js
```

## 🌍 Runtime Compatibility

DexBee is primarily built for **browser environments** but also supports limited Node.js usage:

**✅ Browser Support:**
- Modern browsers (Chrome 24+, Firefox 16+, Safari 8+, Edge 12+)
- Electron applications
- WebView-based applications
- Progressive Web Apps (PWAs)

**✅ Node.js Support (Limited):**
- **Testing environments** with fake-indexeddb
- **Development/prototyping** with memory-only storage
- **CI/CD pipelines** for database logic testing
- **Memory-only cache layers** for structured data
- **Schema validation** and migration testing

**⚠️ Node.js Limitations:**
- Requires `fake-indexeddb` polyfill (memory-only, no persistence)
- Blob/File storage has limitations due to jsdom constraints
- Not suitable for production data persistence
- Binary data handling may be incomplete

**✅ Server-side Support (Limited):**
- **Node.js**: Full compatibility (officially supported)
- **Deno**: Full compatibility (v2+) via `npm:` specifier
- **Bun**: Full compatibility (v1.2.9+) with ESM support
- **Testing environments** with fake-indexeddb
- **Development/prototyping** with memory-only storage
- **CI/CD pipelines** for database logic testing
- **Memory-only cache layers** for structured data
- **Schema validation** and migration testing

**❌ Not supported:**
- Cloudflare Workers (different storage APIs)

## 🚀 Quick Start

### Browser Usage (Recommended)

```typescript
import { DexBee, type DatabaseSchema, eq, gt } from 'dexbee-js'

const schema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        age: { type: 'number' }
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
}

const db = await DexBee.connect('myapp', schema)
const users = db.table('users')

// Insert data
await users.insert({ name: 'John', age: 30 })

// Query with SQL-like syntax
const adults = await users
  .where(gt('age', 18))
  .orderBy('name')
  .all()
```

### Server-side Usage (Limited)

DexBee works in server-side environments using `fake-indexeddb` as a polyfill:

```bash
# Node.js - install fake-indexeddb
npm install fake-indexeddb

# Deno - no installation needed, uses npm: specifier
# Bun - may need "type": "module" in package.json for some versions
```

```typescript
// Node.js
import 'fake-indexeddb/auto'
import { DexBee, defineSchema, eq } from 'dexbee-js'

// Deno
import 'npm:fake-indexeddb/auto'
import { DexBee, defineSchema, eq } from 'npm:dexbee-js'

const schema = defineSchema({
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
})

// Testing database logic
const db = await DexBee.connect('test-db', schema)
const users = db.table('users')

// Test data operations
await users.insert({ name: 'Alice', email: 'alice@example.com' })
const alice = await users.where(eq('name', 'Alice')).first()
console.log('Found user:', alice?.name)
```

**Run with:**
```bash
# Node.js
npx tsx examples/node-testing-example.ts

# Deno
deno run --allow-all examples/deno-testing-example.ts
```

**Runtime Compatibility:**
- **Node.js**: Full compatibility (officially supported)
- **Deno**: Full compatibility (v2+) via npm import
- **Bun**: Full compatibility (v1.2.9+) with ESM support

**⚠️ Important Notes:**
- Data is stored in memory only (not persisted to disk)
- Blob/File storage has limitations
- Best suited for testing, development, and temporary caching
- Not recommended for production data persistence
- Deno requires `--allow-all` flag for full functionality

### Basic Example

```typescript
import { DexBee, eq, gt } from 'dexbee-js'

// Quick start with DexBee
const db = await DexBee.connect('myapp', {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        age: { type: 'number' }
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
} as const)

// Insert and query data
const users = db.table('users')
await users.insert({ name: 'Alice', age: 25 })
const adults = await users.where(gt('age', 18)).all()
console.log(adults) // [{ id: 1, name: 'Alice', age: 25 }]
```

### Define Your Schema

```typescript
import { DexBee, type DatabaseSchema } from 'dexbee-js'

const schema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', unique: true },
        age: { type: 'number' },
        createdAt: { type: 'date', default: () => new Date() }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'email', keyPath: 'email', unique: true },
        { name: 'age', keyPath: 'age' }
      ]
    },
    posts: {
      schema: {
        id: { type: 'number', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string' },
        authorId: { type: 'number', required: true },
        publishedAt: { type: 'date' }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'authorId', keyPath: 'authorId' },
        { name: 'publishedAt', keyPath: 'publishedAt' }
      ]
    }
  }
}
```

### Connect to Database

```typescript
// Create and connect to database
const db = await DexBee.connect('myapp', schema)

// Or create without auto-connect
const db = DexBee.create('myapp', schema)
await db.connect()
```

### Basic Operations

```typescript
// Get table references
const users = db.table('users')
const posts = db.table('posts')

// Insert data
await users.insert({
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
})

// Query with SQL-like syntax
import { eq, gt, and, or } from 'dexbee-js'

// Find user by email
const user = await users
  .select()
  .where(eq('email', 'john@example.com'))
  .first()

// Complex queries
const youngAdults = await users
  .select()
  .where(and(
    gt('age', 18),
    lt('age', 30)
  ))
  .orderBy('name')
  .limit(10)
  .all()

// Update records (use direct method)
await users.update(1, { age: 31 })

// Delete records (use direct method)
await users.delete(1)
```

## 📖 Advanced Usage

### Transactions

```typescript
import { TransactionWrapper } from 'dexbee-js'

await db.transaction(['users', 'posts'], 'readwrite', async (tx) => {
  const txUsers = tx.table('users')
  const txPosts = tx.table('posts')
  
  // All operations are wrapped in a single transaction
  await txUsers.insert({ id: '2', name: 'Jane Doe', email: 'jane@example.com' })
  await txPosts.insert({ 
    id: '1', 
    title: 'Hello World', 
    authorId: '2',
    content: 'My first post!'
  })
  
  // Transaction commits automatically on success
  // Rolls back automatically on error
})
```

### Operation Queuing

DexBee automatically prevents race conditions by queuing operations on the same record while allowing parallel execution across different records.

```typescript
// Automatic queuing is enabled by default
const users = db.table('users')

// These operations on the same user execute sequentially (no race conditions)
await Promise.all([
  users.update(1, { count: users.count + 1 }),  // Executes first
  users.update(1, { status: 'active' })          // Executes second
])

// These operations on different users execute in parallel
await Promise.all([
  users.update(1, { count: 10 }),  // Parallel
  users.update(2, { count: 20 })   // Parallel
])

// Disable queuing if needed (not recommended for concurrent operations)
const usersUnqueued = db.table('users', { queueOperations: false })
```

**Key Benefits:**
- 🚀 **Parallel performance** - Different records operate concurrently
- 🔒 **Data integrity** - Same record operations are sequential
- ⚙️ **Configurable** - Enable/disable via `TableOptions.queueOperations`
- 🎯 **Automatic** - Works transparently without manual coordination

### Schema Migrations

Import the migration plugin separately to keep your bundle size small:

```typescript
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

// Connect with your current schema
const db = await DexBee.connect('myapp', currentSchema)

// Add migration capabilities
const migratable = withMigrations(db)

// Define new schema with added fields
const newSchema: DatabaseSchema = {
  version: 2,
  tables: {
    users: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: false },
        avatar: { type: 'string', required: false }, // New field
        isActive: { type: 'boolean', default: true }, // New field
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
}

// Preview migration with dry run
const dryRun = await migratable.dryRunMigration(newSchema)
console.log('Operations:', dryRun.operations)
console.log('Valid:', dryRun.isValid)

// Apply migration with safety options
if (dryRun.isValid) {
  const result = await migratable.migrate(newSchema, {
    createBackup: true,
    rollbackOnError: true
  })
  console.log(`Migration completed: ${result.operationsExecuted} operations`)
}
```

See [docs/migrations.md](./docs/migrations.md) for detailed migration documentation.

### Query Builder API

```typescript
// Comparison operators
import { eq, gt, gte, lt, lte, between, in_, notIn } from 'dexbee-js'

// Logical operators  
import { and, or, not } from 'dexbee-js'

// Complex query example
const results = await users
  .select(['name', 'email', 'age']) // Select specific fields
  .where(
    and(
      or(
        between('age', 25, 35),
        in_('name', ['Alice', 'Bob', 'Charlie'])
      ),
      not(eq('email', 'banned@example.com'))
    )
  )
  .orderBy('name', 'asc')
  .orderBy('age', 'desc')
  .limit(20)
  .offset(10)
  .all()

// Blob-specific queries
import { sizeGt, sizeLt, mimeType, sizeBetween } from 'dexbee-js'

// Find large files
const largeFiles = await fileTable
  .where(sizeGt('content', 1024 * 1024)) // > 1MB
  .all()

// Find images within size range
const mediumImages = await fileTable
  .where(
    and(
      mimeType('content', 'image/jpeg'),
      sizeBetween('content', 100 * 1024, 500 * 1024) // 100KB - 500KB
    )
  )
  .all()
```

### Blob Storage

DexBee provides comprehensive support for storing and retrieving binary data:

```typescript
// Store files and blobs
const fileTable = db.table('documents')

// Insert with file/blob data
const file = new File(['Hello world'], 'document.txt', { type: 'text/plain' })
await fileTable.insertWithBlob(
  { title: 'My Document', createdAt: new Date() },
  { content: file }
)

// Update blob data
const newFile = new File(['Updated content'], 'document.txt')
await fileTable.updateBlob(1, 'content', newFile)

// Get blob metadata
const metadata = await fileTable.getBlobMetadata(1, 'content')
console.log(metadata) // { size: 15, type: 'text/plain', name: 'document.txt', ... }

// Create object URL (remember to revoke!)
const url = await fileTable.getBlobUrl(1, 'content')
// Use URL for downloads, previews, etc.
URL.revokeObjectURL(url) // Clean up memory
```

### Tree Shaking & Bundle Size

DexBee is optimized for tree-shaking with separate entry points for different features:

| Import Pattern | Bundle Size (gzipped) | Use Case |
|----------------|----------------------|----------|
| Core only | ~34KB | Basic database operations |
| With migrations | ~56KB | Apps with schema evolution |
| Query-heavy | ~35KB | Read-heavy applications |

```typescript
// Core only (~34KB) - Basic database operations
import { DexBee, eq, and } from 'dexbee-js'

// With migrations (~56KB) - When you need schema evolution
import { DexBee } from 'dexbee-js'
import { withMigrations } from 'dexbee-js/migrations'

const db = await DexBee.connect('mydb', schema)
const migratable = withMigrations(db)
await migratable.migrate(newSchema)
```

The migration system is in a separate entry point (`dexbee-js/migrations`) to keep the core bundle small. Only import migrations when you need them!

## 🔧 API Reference

### Core Classes

- **`DexBee`** - Main factory class for creating database instances
- **`Database`** - Primary database interface
- **`Table`** - Table-specific operations and queries
- **`QueryBuilder`** - SQL-like query construction
- **`TransactionWrapper`** - Transaction management

### Query Operators

- **Comparison**: `eq`, `gt`, `gte`, `lt`, `lte`, `between`, `in_`, `notIn`
- **Logical**: `and`, `or`, `not`
- **Blob-specific**: `sizeGt`, `sizeLt`, `sizeBetween`, `mimeType`

### Migration Operations (from `dexbee-js/migrations`)

Import migrations separately to optimize bundle size:

```typescript
import { withMigrations } from 'dexbee-js/migrations'
```

- **`withMigrations(db)`** - Add migration capabilities to a Database instance
- **`migrate(schema, options)`** - Apply schema migration
- **`dryRunMigration(schema)`** - Preview migration without applying
- **`rollback(version)`** - Rollback to a previous version
- **`getMigrationStatus()`** - Get current migration state

See [docs/migrations.md](./docs/migrations.md) for complete migration documentation.

## 🧪 Testing

DexBee includes comprehensive test coverage with both unit tests and browser integration tests:

### Unit Tests
Run the standard test suite (uses fake-indexeddb for Node.js compatibility):

```bash
npm test
```

### Browser Integration Tests
Run tests in real browsers with actual IndexedDB (essential for blob storage):

```bash
npm run test:integration:browser
```

### Run All Tests
Execute both unit and browser integration tests:

```bash
npm run test:all
```

### Test Coverage
Generate detailed coverage reports:

```bash
npm run test:coverage
```

### Interactive Testing
Use the test UI for development:

```bash
# Unit test UI
npm run test:ui

# Browser test UI
npm run test:integration:browser:ui
```

### Manual Browser Testing
For manual testing of blob storage and other browser-specific features, DexBee includes an interactive HTML test interface:

```bash
# Build the library first
npm run build

# Start a local server (choose one):
python3 -m http.server 8080
# OR
npx http-server -p 8080

# Open in browser
open http://localhost:8080/tests/manual/blob-test.html
```

The manual test interface allows you to test blob storage operations interactively in a real browser environment.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web standards and TypeScript
- Inspired by modern ORM patterns and SQL query builders
- Thanks to the IndexedDB specification and browser vendors

---

**DexBee** - Making IndexedDB sweet as honey 🍯