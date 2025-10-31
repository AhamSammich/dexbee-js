/**
 * DexBee Migration Plugin
 *
 * This module provides enterprise-grade schema migration capabilities for DexBee databases.
 * Import this only when you need migration features to keep your bundle size minimal.
 *
 * @example
 * ```typescript
 * import { DexBee } from 'dexbee-js'
 * import { withMigrations } from 'dexbee-js/migrations'
 *
 * const db = await DexBee.connect('mydb', schema)
 * const migratable = withMigrations(db)
 *
 * await migratable.migrate(newSchema, {
 *   createBackup: true,
 *   rollbackOnError: true
 * })
 * ```
 *
 * @module migrations
 */

import type { Database } from './core/database.js'
import type {
  DryRunResult,
  MigrationOptions,
  MigrationResult,
  MigrationStatus,
} from './types/migration.js'
import type { DatabaseSchema } from './types/schema.js'
import { MigrationManager } from './core/migration-manager.js'
import { DexBeeError, DexBeeErrorCode } from './types/errors.js'

/**
 * Database instance augmented with migration capabilities.
 *
 * This interface extends the base Database with methods for schema evolution,
 * migration management, and rollback operations.
 */
export interface MigratableDatabase<TSchema extends DatabaseSchema = DatabaseSchema>
  extends Database<TSchema> {
  /**
   * Apply a schema migration to transform the database structure.
   *
   * This method generates a migration plan, validates it, and applies the changes
   * to the database. It supports automatic rollback on errors and data backups.
   *
   * @param newSchema - The target schema to migrate to
   * @param options - Migration options for safety and control
   * @returns Result of the migration including success status and operations executed
   *
   * @example
   * ```typescript
   * const result = await migratable.migrate(newSchema, {
   *   createBackup: true,
   *   rollbackOnError: true,
   *   validateEachStep: true
   * })
   *
   * if (result.success) {
   *   console.log(`Migration completed: ${result.operationsExecuted} operations`)
   * }
   * ```
   */
  migrate: (newSchema: DatabaseSchema, options?: MigrationOptions) => Promise<MigrationResult>

  /**
   * Preview a migration without applying any changes.
   *
   * Performs a dry run to validate the migration plan, estimate duration,
   * and identify potential issues before applying the migration.
   *
   * @param newSchema - The target schema to analyze
   * @param options - Migration options
   * @returns Dry run result with validation and warnings
   *
   * @example
   * ```typescript
   * const dryRun = await migratable.dryRunMigration(newSchema)
   *
   * console.log('Operations:', dryRun.operations)
   * console.log('Warnings:', dryRun.warnings)
   * console.log('Valid:', dryRun.isValid)
   *
   * if (dryRun.isValid && dryRun.warnings.length === 0) {
   *   await migratable.migrate(newSchema)
   * }
   * ```
   */
  dryRunMigration: (newSchema: DatabaseSchema, options?: MigrationOptions) => Promise<DryRunResult>

  /**
   * Get current migration status and history.
   *
   * Returns information about the current schema version, applied migrations,
   * and any pending migrations.
   *
   * @returns Current migration status
   *
   * @example
   * ```typescript
   * const status = await migratable.getMigrationStatus()
   * console.log(`Current version: ${status.currentVersion}`)
   * console.log(`Up to date: ${status.isUpToDate}`)
   * ```
   */
  getMigrationStatus: () => Promise<MigrationStatus>
}

/**
 * Augment a Database instance with migration capabilities.
 *
 * This function wraps a Database instance and adds enterprise-grade migration
 * methods for schema evolution. The original database functionality remains
 * intact and accessible.
 *
 * @param database - The Database instance to augment
 * @returns A database instance with migration methods
 *
 * @example
 * ```typescript
 * import { DexBee } from 'dexbee-js'
 * import { withMigrations } from 'dexbee-js/migrations'
 *
 * const db = await DexBee.connect('mydb', schema)
 * const migratable = withMigrations(db)
 *
 * // Now you can use migration methods
 * const dryRun = await migratable.dryRunMigration(newSchema)
 * if (dryRun.isValid) {
 *   await migratable.migrate(newSchema, {
 *     createBackup: true,
 *     rollbackOnError: true
 *   })
 * }
 * ```
 */
export function withMigrations<TSchema extends DatabaseSchema>(
  database: Database<TSchema>,
): MigratableDatabase<TSchema> {
  // Create a migration manager instance for this database
  // Cast to Database<DatabaseSchema> for MigrationManager compatibility
  const migrationManager = new MigrationManager(database as unknown as Database<DatabaseSchema>)

  // Create augmented database object with migration methods
  const migratable = database as MigratableDatabase<TSchema>

  // Add migration methods
  migratable.migrate = async function (
    newSchema: DatabaseSchema,
    options?: MigrationOptions,
  ): Promise<MigrationResult> {
    if (!database.isConnected()) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    const currentSchema = database.getSchema()
    const migrationPlan = await migrationManager.generateMigration(currentSchema, newSchema, options)

    const result = await migrationManager.applyMigration(migrationPlan, options)

    // Update schema manager with new schema if migration was successful
    // Note: This requires access to internal Database state, which we'll handle via the Database class
    if (result.success) {
      // The migration manager will handle this internally for now
      // In a future iteration, we might expose a method to update the schema
      console.info('Migration completed successfully. Database schema updated.')
    }

    return result
  }

  migratable.dryRunMigration = async function (
    newSchema: DatabaseSchema,
    options?: MigrationOptions,
  ): Promise<DryRunResult> {
    if (!database.isConnected()) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    const currentSchema = database.getSchema()
    const migrationPlan = await migrationManager.generateMigration(currentSchema, newSchema, options)

    return migrationManager.dryRun(migrationPlan)
  }

  migratable.getMigrationStatus = async function (): Promise<MigrationStatus> {
    if (!database.isConnected()) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    return migrationManager.getMigrationStatus()
  }

  return migratable
}

// =============================================================================
// RE-EXPORT MIGRATION SYSTEM COMPONENTS
// =============================================================================

/**
 * Migration management classes and utilities.
 *
 * These are exported for advanced use cases where you need direct access
 * to migration internals. Most users should use the {@link withMigrations}
 * function instead.
 */

export { MigrationManager } from './core/migration-manager.js'
export { SchemaDiffEngine } from './core/schema-diff-engine.js'
export { DataTransformer } from './migration/data-transformer.js'

export { AddFieldOperation } from './migration/operations/add-field-operation.js'
/**
 * Individual migration operations.
 *
 * These are the atomic operations that make up migration plans.
 * Exported for advanced migration scenarios and custom migration logic.
 */
export { AddTableOperation } from './migration/operations/add-table-operation.js'
export { AlterFieldOperation } from './migration/operations/alter-field-operation.js'
export { DropFieldOperation } from './migration/operations/drop-field-operation.js'
export { DropTableOperation } from './migration/operations/drop-table-operation.js'
export { TransformDataOperation } from './migration/operations/transform-data-operation.js'

/**
 * Migration type definitions.
 *
 * Type definitions for migration plans, operations, and results.
 */
export type {
  DataTransformation,
  DryRunResult,
  MigrationOperation,
  MigrationOptions,
  MigrationPlan,
  MigrationResult,
  MigrationStatus,
  ValidationResult,
} from './types/migration.js'
