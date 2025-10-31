import type {
  DryRunResult,
  MigrationOptions,
  MigrationPlan,
  MigrationResult,
  MigrationStatus,
} from '../types/migration'
import type { DatabaseSchema } from '../types/schema'
import type { Database } from './database'
import { DataTransformer } from '../migration/data-transformer'
import { MigrationValidator } from '../migration/safety/migration-validator'
import { DexBeeError, DexBeeErrorCode } from '../types/errors'
import { SchemaDiffEngine } from './schema-diff-engine'

export class MigrationManager {
  private diffEngine: SchemaDiffEngine
  private transformer: DataTransformer
  private validator: MigrationValidator

  constructor(
    private database: Database,
  ) {
    this.diffEngine = new SchemaDiffEngine()
    this.transformer = new DataTransformer()
    this.validator = new MigrationValidator()
  }

  /**
   * Generate a migration plan from schema differences
   */
  async generateMigration(
    oldSchema: DatabaseSchema,
    newSchema: DatabaseSchema,
    options: MigrationOptions = {},
  ): Promise<MigrationPlan> {
    try {
      console.info(`Generating migration from version ${oldSchema.version} to ${newSchema.version}`)

      // Generate schema diff
      const diff = this.diffEngine.generateDiff(oldSchema, newSchema)

      // Create migration operations
      const operations = await this.diffEngine.createMigrationOperations(diff)

      // Validate operations
      for (const operation of operations) {
        if (operation.validate) {
          operation.validate(oldSchema, newSchema)
        }
      }

      // Estimate complexity and duration
      const complexity = this.diffEngine.estimateMigrationComplexity(operations)

      const migrationPlan: MigrationPlan = {
        version: newSchema.version,
        operations,
        dependencies: [], // Could be enhanced to track schema dependencies
        estimatedDuration: complexity.estimatedDuration,
      }

      // Validate the complete plan
      const validation = this.validator.validateMigrationPlan(migrationPlan)
      if (!validation.isValid) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
          `Migration plan validation failed: ${validation.errors.join('; ')}`,
        )
      }

      if (validation.warnings.length > 0) {
        console.warn('Migration plan warnings:', validation.warnings)
      }

      console.info(`Generated migration plan with ${operations.length} operations`)
      return migrationPlan
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_GENERATION_FAILED,
        `Failed to generate migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Apply a migration plan
   */
  async applyMigration(migration: MigrationPlan, options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      version: migration.version,
      operationsExecuted: 0,
      duration: 0,
      errors: [],
    }

    try {
      const { dryRun = false, validateEachStep = true } = options

      console.info(`${dryRun ? 'Dry run for' : 'Applying'} migration to version ${migration.version}`)

      // Dry run first if requested
      if (dryRun) {
        const dryRunResult = await this.dryRun(migration)
        if (!dryRunResult.isValid) {
          throw new DexBeeError(
            DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
            `Dry run failed: ${dryRunResult.errors.join('; ')}`,
          )
        }
        result.success = true
        return result
      }

      // Apply operations

      try {
        for (const operation of migration.operations) {
          console.info(`Executing ${operation.type} on ${operation.tableName}`)

          // Get database connection for the operation
          const db = this.database.getConnection()
          if (!db) {
            throw new DexBeeError(DexBeeErrorCode.CONNECTION_FAILED, 'Database connection not available')
          }

          await operation.execute(db)
          result.operationsExecuted++

          if (validateEachStep) {
            // Could add validation after each step
            console.debug(`Completed ${operation.type} on ${operation.tableName}`)
          }
        }

        result.success = true
        console.info(`Migration to version ${migration.version} completed successfully`)
      }
      catch (error) {
        result.success = false
        result.errors = [error instanceof Error ? error : new Error('Unknown execution error')]

        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
          `Migration failed: ${result.errors.map(e => e.message).join('; ')}`,
        )
      }
    }
    catch (error) {
      result.success = false
      if (!result.errors) {
        result.errors = []
      }
      result.errors.push(error instanceof Error ? error : new Error('Unknown error'))
      throw error
    }
    finally {
      result.duration = Date.now() - startTime
    }

    return result
  }

  /**
   * Perform a dry run of a migration
   */
  async dryRun(migration: MigrationPlan): Promise<DryRunResult> {
    const result: DryRunResult = {
      isValid: true,
      estimatedDuration: migration.estimatedDuration,
      operations: migration.operations,
      warnings: [],
      errors: [],
    }

    try {
      console.info(`Performing dry run for migration to version ${migration.version}`)

      // Validate migration plan
      const validation = this.validator.validateMigrationPlan(migration)
      result.isValid = validation.isValid
      result.errors = validation.errors
      result.warnings = validation.warnings

      // Additional safety checks
      const destructiveOps = migration.operations.filter(op =>
        ['dropTable', 'dropField', 'transformData'].includes(op.type),
      )

      if (destructiveOps.length > 0) {
        result.warnings.push(`${destructiveOps.length} potentially destructive operations detected`)
      }

      console.info(`Dry run completed - valid: ${result.isValid}, warnings: ${result.warnings.length}`)
    }
    catch (error) {
      result.isValid = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown dry run error')
    }

    return result
  }

  /**
   * Get current migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      // Get current version from database schema
      const currentVersion = this.database.getSchema().version

      const status: MigrationStatus = {
        currentVersion,
      }

      return status
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_STATUS_FAILED,
        `Failed to get migration status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }
}
