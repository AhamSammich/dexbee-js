# DexBee Usage Examples

This directory contains examples demonstrating different ways to use DexBee.

## Examples

### 1. Phase 1 Demo (`phase1-demo.ts`)
Complete demonstration of Phase 1 functionality including:
- Schema definition and validation
- Database connection management
- Transaction handling
- CRUD operations
- Error handling

Run with: `npx tsx examples/phase1-demo.ts`

### 2. Script Tag Usage (`script-tag-usage.html`)
Shows how to use DexBee directly in the browser via script tag (UMD build):
- No build tools required
- Global `DexBee` object available
- Direct IndexedDB operations in the browser

Open in browser to test the UMD build.

### 3. Todo List Demo (`todo-list-demo.html`)
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
