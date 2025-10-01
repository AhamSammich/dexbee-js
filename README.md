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
- 🌐 **Modern ESM** - Full ESM support with TypeScript declarations
- 🎨 **Query builder** - Intuitive, chainable query interface
- 🌍 **Browser-focused** - Built specifically for IndexedDB in browser environments

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

## 🌍 Browser Compatibility

DexBee is built specifically for **browser environments** and requires IndexedDB support:

**✅ Supported:**
- Modern browsers (Chrome 24+, Firefox 16+, Safari 8+, Edge 12+)
- Electron applications
- WebView-based applications
- Progressive Web Apps (PWAs)

**❌ Not supported:**
- Node.js (no IndexedDB)
- Deno server-side (no IndexedDB) 
- Bun server-side (no IndexedDB)
- Cloudflare Workers (different storage APIs)

## 🚀 Quick Start

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
})

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

### Schema Migrations

```typescript
// Version 2 of your schema - add new fields
const schemaV2: DatabaseSchema = {
  version: 2,
  tables: {
    users: {
      fields: {
        id: { type: 'string', primaryKey: true },
        name: { type: 'string', required: true },
        email: { type: 'string', unique: true },
        age: { type: 'number' },
        avatar: { type: 'string' }, // New field
        isActive: { type: 'boolean', default: true }, // New field
        createdAt: { type: 'date', default: () => new Date() }
      }
      // ... rest of schema
    }
  },
  migrations: [
    {
      version: 2,
      operations: [
        {
          type: 'addField',
          table: 'users',
          field: 'avatar',
          definition: { type: 'string' }
        },
        {
          type: 'addField', 
          table: 'users',
          field: 'isActive',
          definition: { type: 'boolean', default: true }
        }
      ]
    }
  ]
}

// DexBee automatically handles the migration
const db = await DexBee.connect('myapp', schemaV2)
```

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
```

### Tree Shaking

DexBee is built with tree-shaking in mind. Import only what you need:

```typescript
// Minimal import for basic operations
import { DexBee, eq, gt } from 'dexbee-js'

// Or import specific modules
import { Database } from 'dexbee-js/database'
import { QueryBuilder } from 'dexbee-js/query-builder'
import { eq, and } from 'dexbee-js/operators'
```

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

### Migration Operations

- **Schema**: `AddTableOperation`, `DropTableOperation`
- **Fields**: `AddFieldOperation`, `DropFieldOperation`, `AlterFieldOperation`  
- **Indexes**: `AddIndexOperation`, `DropIndexOperation`
- **Data**: `TransformDataOperation`

## 🧪 Testing

DexBee includes comprehensive test coverage. Run tests with:

```bash
npm test
```

For test coverage:

```bash
npm run test:coverage
```

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