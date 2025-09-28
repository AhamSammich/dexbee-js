/* eslint-disable perfectionist/sort-exports */
// =============================================================================
// DexBee - TypeScript IndexedDB ORM with SQL-like Query Builder
// =============================================================================

import type { DatabaseSchema } from './types/schema.js'
import { Database } from './core/database.js'

// =============================================================================
// CORE API - Essential classes for basic database operations
// Tree-shaking: Import only what you need for minimal bundle size
// =============================================================================

// Main database API
export { Database } from './core/database.js'
export { DatabaseManager } from './core/database-manager.js'
export { SchemaManager } from './core/schema-manager.js'
export { TransactionManager } from './core/transaction-manager.js'
export { TransactionWrapper } from './core/transaction-wrapper.js'

// Core interfaces
export type {
  IDatabase,
  IDatabaseManager,
  ISchemaManager,
  ITransactionManager,
  ITransactionWrapper,
} from './core/interfaces.js'

// =============================================================================
// QUERY SYSTEM - SQL-like query builder and operators
// Tree-shaking: These can be imported independently for read-only applications
// =============================================================================

// Query builder classes
export { QueryBuilder } from './query/query-builder.js'
export { QueryExecutor } from './query/query-executor.js'
export { Table } from './query/table.js'

// Query operators (highly tree-shakeable)
export {
  and,
  between,
  eq,
  gt,
  gte,
  in_,
  lt,
  lte,
  not,
  notIn,
  or,
} from './query/operators.js'

// Query interfaces
export type {
  IConditionBuilder,
  IQueryBuilder,
  IQueryExecutor,
} from './query/interfaces.js'

// =============================================================================
// MIGRATION SYSTEM - Enterprise schema evolution (can be tree-shaken out)
// Tree-shaking: Only bundled when migration features are imported
// =============================================================================

// Migration management
export { MigrationManager } from './core/migration-manager.js'
export { MigrationHistoryManager } from './core/migration-history.js'
export { SchemaDiffEngine } from './core/schema-diff-engine.js'
export { DataTransformer } from './migration/data-transformer.js'

// Migration operations (individual operations are tree-shakeable)
export { AddTableOperation } from './migration/operations/add-table-operation.js'
export { DropTableOperation } from './migration/operations/drop-table-operation.js'
export { AddFieldOperation } from './migration/operations/add-field-operation.js'
export { DropFieldOperation } from './migration/operations/drop-field-operation.js'
export { AlterFieldOperation } from './migration/operations/alter-field-operation.js'
export { AddIndexOperation, DropIndexOperation } from './migration/operations/add-index-operation.js'
export { TransformDataOperation } from './migration/operations/transform-data-operation.js'

// =============================================================================
// TYPE DEFINITIONS - Import only the types you need
// =============================================================================

// Core schema types
export type {
  DatabaseSchema,
  FieldDefinition,
  FieldType,
  IndexDefinition,
  Migration,
  TableConfig,
  TableSchema,
} from './types/schema.js'

// Query types
export type {
  ComparisonOperator,
  LogicalOperator,
  QueryOptions,
  QueryResult,
  WhereCondition,
} from './types/query.js'

// Migration types (tree-shakeable with migration system)
export type {
  DataTransformation,
  DryRunResult,
  MigrationOperation,
  MigrationOptions,
  MigrationPlan,
  MigrationRecord,
  MigrationResult,
  MigrationStatus,
  RollbackResult,
  ValidationResult,
} from './types/migration.js'

// Transaction types
export type {
  TransactionMode,
  TransactionOptions,
  TransactionResult,
} from './types/transaction.js'

// Error types
export {
  DexBeeError,
  DexBeeErrorCode,
} from './types/errors.js'

export class DexBee {
  static create(name: string, schema: DatabaseSchema): Database {
    return new Database(name, schema)
  }

  static async connect(name: string, schema: DatabaseSchema): Promise<Database> {
    const db = new Database(name, schema)
    await db.connect()
    return db
  }
}
