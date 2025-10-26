/**
 * DexBee - A modern TypeScript IndexedDB ORM with SQL-like query builder interface.
 *
 * DexBee provides a powerful, type-safe way to work with IndexedDB in the browser.
 * It features a SQL-like query builder, automatic schema migrations, and full TypeScript support.
 *
 * This module exports all the core functionality including database management,
 * query building, schema migrations, and type definitions.
 *
 * @example Basic usage
 * ```ts
 * import { DexBee, type DatabaseSchema, eq, gt } from 'dexbee-js'
 *
 * const schema: DatabaseSchema = {
 *   version: 1,
 *   tables: {
 *     users: {
 *       schema: {
 *         id: { type: 'number', required: true },
 *         name: { type: 'string', required: true },
 *         age: { type: 'number' }
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true
 *     }
 *   }
 * }
 *
 * const db = await DexBee.connect('myapp', schema)
 * const users = db.table('users')
 *
 * // Insert data
 * await users.insert({ name: 'John', age: 30 })
 *
 * // Query with SQL-like syntax
 * const adults = await users
 *   .where(gt('age', 18))
 *   .orderBy('name')
 *   .all()
 * ```
 *
 * @example Tree-shaking imports
 * ```ts
 * // Core-only usage (smaller bundle)
 * import { DexBee, eq, and } from 'dexbee-js'
 *
 * // Query-heavy usage
 * import { QueryBuilder, Table, eq, gt, between } from 'dexbee-js'
 *
 * // Enterprise usage with migrations
 * import { MigrationManager, SchemaDiffEngine } from 'dexbee-js'
 * ```
 *
 * @version 0.1.1
 * @author Andre Hammons
 * @license MIT
 * @module
 */

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

/**
 * Core database management classes.
 *
 * These provide the essential functionality for database operations,
 * schema management, and transaction handling.
 */

/**
 * Primary database interface for table operations and connections.
 *
 * Provides high-level access to IndexedDB with table management,
 * query building, and transaction coordination.
 *
 * ```ts
 * import { Database } from 'dexbee-js'
 *
 * const db = new Database('myapp', schema)
 * await db.connect()
 * const users = db.table('users')
 * ```
 */
export { Database } from './core/database.js'

/**
 * High-level database lifecycle and connection management.
 *
 * Manages IndexedDB connections, handles database opening/closing,
 * and coordinates version upgrades with schema migrations.
 *
 * ```ts
 * import { DatabaseManager } from 'dexbee-js'
 *
 * const manager = new DatabaseManager('myapp', schema)
 * const db = await manager.connect()
 * ```
 */
export { DatabaseManager } from './core/database-manager.js'

/**
 * Schema validation, migration planning, and version management.
 *
 * Validates database schemas, ensures data integrity constraints,
 * and generates migration plans for schema evolution.
 *
 * ```ts
 * import { SchemaManager } from 'dexbee-js'
 *
 * const manager = new SchemaManager(schema)
 * manager.validateSchema() // Throws on invalid schema
 * ```
 */
export { SchemaManager } from './core/schema-manager.js'

/**
 * Transaction coordination and ACID compliance.
 *
 * Provides Promise-based transaction management with automatic
 * lifecycle handling and rollback on errors.
 *
 * ```ts
 * import { TransactionManager } from 'dexbee-js'
 *
 * const txManager = new TransactionManager(db)
 * await txManager.transaction(['users'], 'readwrite', async (tx) => {
 *   // Operations within transaction
 * })
 * ```
 */
export { TransactionManager } from './core/transaction-manager.js'

/**
 * Transaction wrapper for scoped database operations.
 *
 * Wraps individual IndexedDB transactions with a Promise-based
 * interface and automatic error handling.
 *
 * ```ts
 * import { TransactionWrapper } from 'dexbee-js'
 *
 * const wrapper = new TransactionWrapper(idbTransaction)
 * const store = wrapper.getStore('users')
 * ```
 */
export { TransactionWrapper } from './core/transaction-wrapper.js'

/**
 * Core interface types for dependency injection and testing.
 *
 * These interfaces define the contracts for the main database components,
 * allowing for easy mocking and alternative implementations.
 *
 * ```ts
 * import type { IDatabase } from 'dexbee-js'
 *
 * function processUsers(db: IDatabase) {
 *   return db.table('users').all()
 * }
 * ```
 */
export type {
  /** Interface for the main Database class */
  IDatabase,
  /** Interface for DatabaseManager functionality */
  IDatabaseManager,
  /** Interface for SchemaManager functionality */
  ISchemaManager,
  /** Interface for TransactionManager functionality */
  ITransactionManager,
  /** Interface for TransactionWrapper functionality */
  ITransactionWrapper,
} from './core/interfaces.js'

// =============================================================================
// QUERY SYSTEM - SQL-like query builder and operators
// Tree-shaking: These can be imported independently for read-only applications
// =============================================================================

/**
 * SQL-like query builder and execution classes.
 *
 * Build fluent, chainable queries and execute them against IndexedDB.
 * See {@link Table} for the high-level API, and {@link QueryBuilder}
 * for the underlying builder used by table methods.
 */

/**
 * Chainable query builder with SQL-like syntax.
 *
 * ```ts
 * const results = await users
 *   .select('name', 'email')
 *   .where(eq('isActive', true))
 *   .orderBy('name')
 *   .limit(10)
 *   .all()
 * ```
 */
export { QueryBuilder } from './query/query-builder.js'

/**
 * Query execution engine for IndexedDB operations.
 *
 * Generally used internally by {@link QueryBuilder}. Most users should interact
 * with {@link Table} which composes this engine.
 */
export { QueryExecutor } from './query/query-executor.js'

/**
 * Table interface providing CRUD operations and query building.
 *
 * High-level API to work with a specific table while leveraging the
 * SQL-like query builder under the hood.
 */
export { Table } from './query/table.js'

/**
 * Query operators for building WHERE conditions.
 *
 * These operators provide a SQL-like syntax for filtering data:
 * - Comparison: {@link eq}, {@link gt}, {@link gte}, {@link lt}, {@link lte}, {@link between}, {@link inArray}
 * - Logical: {@link and}, {@link or}, {@link not}
 *
 * @example
 * ```ts
 * import { eq, gt, and, or, not, inArray } from 'dexbee-js'
 *
 * // Simple condition
 * .where(eq('name', 'John'))
 *
 * // IN operator
 * .where(inArray('id', [1, 2, 3, 4]))
 *
 * // NOT IN operator (composable approach)
 * .where(not(inArray('status', ['deleted', 'banned'])))
 *
 * // Complex condition
 * .where(
 *   and(
 *     gt('age', 18),
 *     or(
 *       eq('status', 'active'),
 *       eq('status', 'pending')
 *     )
 *   )
 * )
 * ```
 */
export {
  /** Logical AND operator for combining conditions */
  and,
  /** Range operator: field BETWEEN min AND max */
  between,
  /** Equality operator: field = value */
  eq,
  /** Greater than operator: field > value */
  gt,
  /** Greater than or equal operator: field >= value */
  gte,
  /** @deprecated Use inArray instead. This alias will be removed in a future version. */
  in_,
  /** IN operator: field IN (value1, value2, ...) - Recommended over in_ */
  inArray,
  /** Less than operator: field < value */
  lt,
  /** Less than or equal operator: field <= value */
  lte,
  mimeType,
  /** Logical NOT operator for negating conditions */
  not,
  /** @deprecated Use not(inArray(...)) instead. This function will be removed in a future version. */
  notIn,
  /** Logical OR operator for alternative conditions */
  or,
  sizeBetween,
  // Blob-specific operators
  sizeGt,
  sizeLt,
} from './query/operators.js'

/**
 * Query system interface types.
 *
 * Define contracts for query building and execution components.
 * Useful for testing and alternative query implementations.
 *
 * ```ts
 * import type { IQueryBuilder } from 'dexbee-js'
 *
 * function buildQuery(builder: IQueryBuilder) {
 *   return builder.where(eq('active', true)).limit(10)
 * }
 * ```
 */
export type {
  /** Interface for condition builders */
  IConditionBuilder,
  /** Interface for the QueryBuilder class */
  IQueryBuilder,
  /** Interface for the QueryExecutor class */
  IQueryExecutor,
} from './query/interfaces.js'

// =============================================================================
// MIGRATION SYSTEM - Enterprise schema evolution (can be tree-shaken out)
// Tree-shaking: Only bundled when migration features are imported
// =============================================================================

/**
 * Migration management classes.
 *
 * Provides enterprise-grade schema evolution with safety guarantees,
 * rollback capabilities, and data transformation support.
 */

/**
 * Orchestrates database schema migrations.
 *
 * Handles migration planning, execution, and rollback operations.
 * Ensures data integrity throughout the migration process.
 *
 * ```ts
 * import { MigrationManager } from 'dexbee-js'
 *
 * const manager = new MigrationManager(db, schema)
 * const plan = await manager.generateMigrationPlan(oldSchema, newSchema)
 * const result = await manager.executeMigration(plan)
 * ```
 */
export { MigrationManager } from './core/migration-manager.js'

/**
 * Tracks and manages migration history.
 *
 * Maintains records of applied migrations, enabling rollback
 * operations and migration state verification.
 *
 * ```ts
 * import { MigrationHistoryManager } from 'dexbee-js'
 *
 * const history = new MigrationHistoryManager(db)
 * const applied = await history.getAppliedMigrations()
 * await history.recordMigration(migration)
 * ```
 */
export { MigrationHistoryManager } from './core/migration-history.js'

/**
 * Analyzes schema differences and generates migration operations.
 *
 * Compares database schemas and produces atomic migration operations
 * to transform one schema into another safely.
 *
 * ```ts
 * import { SchemaDiffEngine } from 'dexbee-js'
 *
 * const diffEngine = new SchemaDiffEngine()
 * const operations = diffEngine.generateDiff(oldSchema, newSchema)
 * ```
 */
export { SchemaDiffEngine } from './core/schema-diff-engine.js'

/**
 * Handles complex data transformations during migrations.
 *
 * Provides utilities for safely transforming existing data
 * when schema changes require data format updates.
 *
 * ```ts
 * import { DataTransformer } from 'dexbee-js'
 *
 * const transformer = new DataTransformer()
 * await transformer.transformData('users', oldData => ({
 *   ...oldData,
 *   fullName: `${oldData.firstName} ${oldData.lastName}`
 * }))
 * ```
 */
export { DataTransformer } from './migration/data-transformer.js'

/**
 * Individual migration operations (tree-shakeable).
 *
 * Atomic operations that can be combined to form complete migrations.
 * Each operation is reversible and validates data integrity.
 */

/** Creates new tables in the database schema */
export { AddTableOperation } from './migration/operations/add-table-operation.js'
/** Removes tables from the database schema */
export { DropTableOperation } from './migration/operations/drop-table-operation.js'
/** Adds new fields to existing tables */
export { AddFieldOperation } from './migration/operations/add-field-operation.js'
/** Removes fields from existing tables */
export { DropFieldOperation } from './migration/operations/drop-field-operation.js'
/** Modifies existing field definitions */
export { AlterFieldOperation } from './migration/operations/alter-field-operation.js'
/** Transforms existing data during schema changes */
export { TransformDataOperation } from './migration/operations/transform-data-operation.js'

// =============================================================================
// TYPE DEFINITIONS - Import only the types you need
// =============================================================================

/**
 * Core schema definition types.
 *
 * Define database structure, tables, fields, and constraints
 * for type-safe database operations.
 *
 * ```ts
 * import type { DatabaseSchema, FieldDefinition } from 'dexbee-js'
 *
 * const schema: DatabaseSchema = {
 *   version: 1,
 *   tables: {
 *     users: {
 *       schema: {
 *         id: { type: 'number', required: true },
 *         name: { type: 'string', required: true }
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true
 *     }
 *   }
 * }
 * ```
 */
export type {
  BlobFieldDefinition,
  BlobMetadata,
  /** Complete database schema definition with tables and version */
  DatabaseSchema,
  ExtendedFieldDefinition,
  /** Individual field definition with type and constraints */
  FieldDefinition,
  /** Valid field data types: string, number, boolean, date, object, array */
  FieldType,
  /** Index definition for optimized queries */
  IndexDefinition,
  /** Migration definition for schema evolution */
  Migration,
  /** Complete table configuration including schema and indexes */
  TableConfig,
  /** Table schema defining all fields */
  TableSchema,
} from './types/schema.js'

/**
 * Type inference utilities for deriving TypeScript types from schema definitions.
 *
 * These utilities enable full type safety by inferring record types from your schema.
 * Use `as const` when defining schemas to get the most accurate type inference.
 *
 * @example
 * ```ts
 * import type { InferTableType, InferDatabaseTables } from 'dexbee-js'
 *
 * const schema = {
 *   version: 1,
 *   tables: {
 *     users: {
 *       schema: {
 *         id: { type: 'number', required: true },
 *         name: { type: 'string', required: true },
 *         email: { type: 'string' }, // optional
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true,
 *     },
 *   },
 * } as const
 *
 * // Infer a single table type
 * type User = InferTableType<typeof schema, 'users'>
 * // { id: number; name: string; email?: string }
 *
 * // Infer all table types
 * type Tables = InferDatabaseTables<typeof schema>
 * // { users: User }
 * ```
 */
export type {
  /** Helper type to expand/flatten complex types for better IDE tooltips */
  Expand,
  /** Deeply expands nested types for even better tooltip clarity */
  ExpandRecursively,
  /** Extract table names from schema as a string union */
  ExtractTableNames,
  /** Infer TypeScript types for all tables in a schema */
  InferDatabaseTables,
  /** Infer TypeScript type for a single field definition */
  InferFieldType,
  /** Infer TypeScript type for a complete table schema */
  InferSchemaType,
  /** Infer TypeScript type for a specific table in a schema */
  InferTableType,
  /** Type for insert operations - makes auto-increment primary keys optional */
  InsertType,
} from './types/infer.js'

/**
 * Query system type definitions.
 *
 * Types for building and executing database queries with type safety.
 *
 * ```ts
 * import type { WhereCondition, QueryOptions } from 'dexbee-js'
 *
 * const condition: WhereCondition<User> = {
 *   type: 'comparison',
 *   operator: 'eq',
 *   field: 'name',
 *   value: 'John'
 * }
 * ```
 */
export type {
  BlobQueryOptions,
  /** Comparison operators: 'eq', 'gt', 'lt', etc. */
  ComparisonOperator,
  /** Logical operators: 'and', 'or', 'not' */
  LogicalOperator,
  /** Query configuration options */
  QueryOptions,
  /** Query execution result with data and metadata */
  QueryResult,
  /** Where clause condition for filtering */
  WhereCondition,
} from './types/query.js'

/**
 * Migration system type definitions (tree-shakeable).
 *
 * Types for enterprise-grade schema evolution and data migration.
 * Only imported when migration features are used.
 *
 * ```ts
 * import type { MigrationPlan, MigrationOperation } from 'dexbee-js'
 *
 * const plan: MigrationPlan = {
 *   fromVersion: 1,
 *   toVersion: 2,
 *   operations: [...]
 * }
 * ```
 */
export type {
  /** Data transformation function signature */
  DataTransformation,
  /** Result of migration dry run validation */
  DryRunResult,
  /** Individual migration operation definition */
  MigrationOperation,
  /** Migration execution options */
  MigrationOptions,
  /** Complete migration plan with operations */
  MigrationPlan,
  /** Migration history record */
  MigrationRecord,
  /** Migration execution result */
  MigrationResult,
  /** Migration status enumeration */
  MigrationStatus,
  /** Migration rollback result */
  RollbackResult,
  /** Migration validation result */
  ValidationResult,
} from './types/migration.js'

/**
 * Table configuration type definitions.
 *
 * Types for configuring table behavior and features.
 *
 * ```ts
 * import type { TableOptions } from 'dexbee-js'
 *
 * const options: TableOptions = {
 *   queueOperations: true
 * }
 *
 * const table = db.table('users', options)
 * ```
 */
export type {
  /** Table configuration options for operation queuing and other features */
  TableOptions,
} from './types/table.js'

/**
 * Transaction system type definitions.
 *
 * Types for managing database transactions with ACID compliance.
 *
 * ```ts
 * import type { TransactionOptions } from 'dexbee-js'
 *
 * const options: TransactionOptions = {
 *   timeout: 5000,
 *   retryAttempts: 3
 * }
 * ```
 */
export type {
  /** Transaction access mode: 'readonly' | 'readwrite' */
  TransactionMode,
  /** Transaction configuration options */
  TransactionOptions,
  /** Transaction execution result */
  TransactionResult,
} from './types/transaction.js'

/**
 * Error handling types and classes.
 *
 * Comprehensive error system with specific error codes
 * for different failure scenarios.
 *
 * ```ts
 * import { DexBeeError, DexBeeErrorCode } from 'dexbee-js'
 *
 * try {
 *   await db.connect()
 * } catch (error) {
 *   if (error instanceof DexBeeError) {
 *     console.log('DexBee error:', error.code)
 *   }
 * }
 * ```
 */
export {
  /** Base error class for all DexBee errors */
  DexBeeError,
  /** Enumeration of specific error codes */
  DexBeeErrorCode,
} from './types/errors.js'

// =============================================================================
// HELPER FUNCTIONS - Utilities for easier schema definition
// =============================================================================

/**
 * Schema definition helper that enables type inference without `as const`.
 *
 * This is the recommended way to define schemas. It provides better type inference,
 * cleaner error messages, and eliminates the need for `as const` annotations.
 *
 * @example
 * ```ts
 * import { defineSchema, DexBee } from 'dexbee-js'
 *
 * const schema = defineSchema({
 *   version: 1,
 *   tables: {
 *     users: {
 *       schema: {
 *         id: { type: 'number', required: true },
 *         name: { type: 'string', required: true },
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true,
 *     },
 *   },
 * })
 *
 * // No type parameter needed - fully inferred!
 * const db = await DexBee.connect('myapp', schema)
 * ```
 */
export { defineSchema } from './helpers/define-schema.js'

/**
 * Type helper to extract schema type from defineSchema result.
 *
 * ```ts
 * import type { InferSchema } from 'dexbee-js'
 *
 * const schema = defineSchema({ ... })
 * type MySchema = InferSchema<typeof schema>
 * ```
 */
export type { InferSchema } from './helpers/define-schema.js'

// =============================================================================
// MAIN API - DexBee factory class
// =============================================================================

/**
 * Main DexBee factory class for creating database instances.
 *
 * Provides convenient static methods to create and connect to IndexedDB databases
 * with type-safe schema definitions and automatic migrations.
 *
 * This is the primary entry point for using DexBee. Most applications should use
 * {@link connect} for immediate database access, or {@link create} for manual
 * connection control.
 *
 * @example Basic usage
 * ```ts
 * import { DexBee, type DatabaseSchema } from 'dexbee-js'
 *
 * const schema: DatabaseSchema = { \/* schema definition *\/ }
 *
 * // Recommended: Create and connect immediately
 * const db = await DexBee.connect('myapp', schema)
 *
 * // Alternative: Create first, connect later
 * const db = DexBee.create('myapp', schema)
 * await db.connect()
 * ```
 */
export class DexBee {
  /**
   * Creates a new Database instance without connecting to IndexedDB.
   *
   * Use this method when you need to create a database instance but want to control
   * when the actual IndexedDB connection is established. You must call {@link Database.connect}
   * before performing any database operations.
   *
   * @param name - The name of the IndexedDB database. Must be a valid IndexedDB database name.
   * @param schema - Complete database schema definition including version, tables, and constraints.
   * @returns A new {@link Database} instance that is not yet connected to IndexedDB.
   *
   * @example
   * ```ts
   * const schema = {
   *   version: 1,
   *   tables: {
   *     users: {
   *       schema: {
   *         id: { type: 'number', required: true },
   *         name: { type: 'string', required: true },
   *       },
   *       primaryKey: 'id',
   *       autoIncrement: true,
   *     },
   *   },
   * } as const
   *
   * const db = DexBee.create('myapp', schema)
   *
   * // Later, when ready to connect
   * await db.connect()
   * const users = db.table('users') // Fully typed!
   * ```
   *
   * @see {@link connect} for immediate connection
   * @see {@link Database.connect} to connect the created instance
   */
  static create<Schema extends DatabaseSchema>(
    name: string,
    schema: Schema,
  ): Database<Schema> {
    return new Database<Schema>(name, schema)
  }

  /**
   * Creates and immediately connects to an IndexedDB database.
   *
   * This is the recommended method for most use cases. It combines database creation
   * and connection in a single step, automatically handling schema validation,
   * database opening, and any necessary migrations.
   *
   * @param name - The name of the IndexedDB database. Must be a valid IndexedDB database name.
   * @param schema - Complete database schema definition including version, tables, and constraints.
   * @returns A Promise that resolves to a connected {@link Database} instance ready for use.
   *
   * @example
   * ```ts
   * const schema = {
   *   version: 1,
   *   tables: {
   *     users: {
   *       schema: {
   *         id: { type: 'number', required: true },
   *         name: { type: 'string', required: true },
   *         email: { type: 'string' },
   *       },
   *       primaryKey: 'id',
   *       autoIncrement: true,
   *     },
   *   },
   * } as const
   *
   * const db = await DexBee.connect('myapp', schema)
   * const users = db.table('users')
   *
   * // Fully typed! TypeScript knows the shape of User records
   * await users.insert({ name: 'John', email: 'john@example.com' })
   * const allUsers = await users.all() // User[]
   * ```
   *
   * @throws {@link DexBeeError} When database connection fails, schema validation fails, or migrations fail.
   * @throws {@link DexBeeError} When IndexedDB is not available in the current environment.
   *
   * @see {@link create} for manual connection control
   */
  static async connect<Schema extends DatabaseSchema>(
    name: string,
    schema: Schema,
  ): Promise<Database<Schema>> {
    const db = new Database<Schema>(name, schema)
    await db.connect()
    return db
  }
}
