# DexBee 🐝

A modern TypeScript IndexedDB ORM with SQL-like query builder interface. Build powerful browser-based applications with type-safe database operations and automatic schema migrations.

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

## 🚀 Quick Start

### Define Your Schema

```typescript
import { DexBee, type DatabaseSchema } from 'dexbee-js'

const schema: DatabaseSchema = {
  version: 1,
  tables: {
    users: {
      fields: {
        id: { type: 'string', primaryKey: true },
        name: { type: 'string', required: true },
        email: { type: 'string', unique: true },
        age: { type: 'number' },
        createdAt: { type: 'date', default: () => new Date() }
      },
      indexes: [
        { fields: ['email'], unique: true },
        { fields: ['age'] }
      ]
    },
    posts: {
      fields: {
        id: { type: 'string', primaryKey: true },
        title: { type: 'string', required: true },
        content: { type: 'string' },
        authorId: { type: 'string', required: true },
        publishedAt: { type: 'date' }
      },
      indexes: [
        { fields: ['authorId'] },
        { fields: ['publishedAt'] }
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
  .execute()

// Update records
await users
  .update({ age: 31 })
  .where(eq('id', '1'))
  .execute()

// Delete records
await users
  .delete()
  .where(gt('age', 65))
  .execute()
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
  .execute()
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