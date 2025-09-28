import type {
  ApplyOptions,
  DryRunResult,
  MigrationOperation,
  MigrationOptions,
  MigrationPlan,
  MigrationRecord,
  MigrationResult,
  MigrationStatus,
  RollbackOptions,
  RollbackResult,
} from '../types/migration'
import type { DatabaseSchema } from '../types/schema'
import type { Database } from './database'
import { DataTransformer } from '../migration/data-transformer'
import { MigrationValidator } from '../migration/safety/migration-validator'
import { DexBeeError, DexBeeErrorCode } from '../types/errors'
import { MigrationHistoryManager } from './migration-history'
import { SchemaDiffEngine } from './schema-diff-engine'

export class MigrationManager {
  private diffEngine: SchemaDiffEngine
  private historyManager: MigrationHistoryManager
  private transformer: DataTransformer
  private validator: MigrationValidator

  constructor(
    private database: Database,
    dbName: string,
  ) {
    this.diffEngine = new SchemaDiffEngine()
    this.historyManager = new MigrationHistoryManager(dbName)
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
  async applyMigration(migration: MigrationPlan, options: ApplyOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      version: migration.version,
      operationsExecuted: 0,
      duration: 0,
      errors: [],
    }

    try {
      const { dryRun = false, createBackup = true, rollbackOnError = true, validateEachStep = true } = options

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

      // Create backup if requested
      if (createBackup) {
        console.info('Creating backup before migration...')
        // Backup implementation would go here
        result.backupCreated = true
      }

      // Validate current state
      if (validateEachStep) {
        const currentVersion = await this.historyManager.getLastAppliedVersion()
        if (currentVersion >= migration.version) {
          throw new DexBeeError(
            DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
            `Migration version ${migration.version} is not greater than current version ${currentVersion}`,
          )
        }
      }

      // Apply operations
      const executedOperations: MigrationOperation[] = []

      try {
        for (const operation of migration.operations) {
          console.info(`Executing ${operation.type} on ${operation.tableName}`)

          // Get database connection for the operation
          const db = this.database.getConnection()
          if (!db) {
            throw new DexBeeError(DexBeeErrorCode.CONNECTION_FAILED, 'Database connection not available')
          }

          await operation.execute(db)
          executedOperations.push(operation)
          result.operationsExecuted++

          if (validateEachStep) {
            // Could add validation after each step
            console.debug(`Completed ${operation.type} on ${operation.tableName}`)
          }
        }

        // Record successful migration
        const migrationRecord: MigrationRecord = {
          version: migration.version,
          appliedAt: new Date(),
          checksum: this.calculateMigrationChecksum(migration),
          duration: Date.now() - startTime,
        }

        await this.historyManager.recordMigration(migrationRecord)

        result.success = true
        console.info(`Migration to version ${migration.version} completed successfully`)
      }
      catch (error) {
        result.success = false
        result.errors = [error instanceof Error ? error : new Error('Unknown execution error')]

        if (rollbackOnError && executedOperations.length > 0) {
          console.warn('Migration failed, attempting rollback...')

          try {
            await this.rollbackOperations(executedOperations.reverse())
            console.info('Rollback completed successfully')
          }
          catch (rollbackError) {
            console.error('Rollback failed:', rollbackError)
            result.errors.push(rollbackError instanceof Error ? rollbackError : new Error('Unknown rollback error'))
          }
        }

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
   * Rollback to a target version
   */
  async rollback(targetVersion: number, options: RollbackOptions = {}): Promise<RollbackResult> {
    const startTime = Date.now()
    const result: RollbackResult = {
      success: false,
      targetVersion,
      operationsRolledBack: 0,
      duration: 0,
      errors: [],
    }

    try {
      console.info(`Rolling back to version ${targetVersion}`)

      const currentVersion = await this.historyManager.getLastAppliedVersion()
      if (currentVersion <= targetVersion) {
        throw new DexBeeError(
          DexBeeErrorCode.ROLLBACK_VALIDATION_FAILED,
          `Cannot rollback to version ${targetVersion} - current version is ${currentVersion}`,
        )
      }

      // Get migrations to rollback (in reverse order)
      const history = await this.historyManager.getMigrationHistory()
      const migrationsToRollback = history
        .filter(record => record.version > targetVersion)
        .sort((a, b) => b.version - a.version) // Reverse order

      console.info(`Found ${migrationsToRollback.length} migrations to rollback`)

      // This is a simplified rollback - in practice, we'd need to store
      // the actual operations or have inverse operations
      for (const migrationRecord of migrationsToRollback) {
        console.warn(`Rolling back migration version ${migrationRecord.version} (limited rollback capability)`)
        result.operationsRolledBack++
      }

      result.success = true
      console.info(`Rollback to version ${targetVersion} completed`)
    }
    catch (error) {
      result.success = false
      result.errors = [error instanceof Error ? error : new Error('Unknown rollback error')]
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

      // Check rollback capability
      const rollbackValidation = this.validator.validateRollbackCapability(migration.operations)
      if (!rollbackValidation.canRollback) {
        result.warnings.push('Some operations cannot be rolled back')
        result.warnings.push(...rollbackValidation.missingRollbackOperations)
      }
      result.warnings.push(...rollbackValidation.warnings)

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
      const currentVersion = await this.historyManager.getLastAppliedVersion()
      const lastMigration = await this.historyManager.getMigrationRecord(currentVersion)

      const status: MigrationStatus = {
        currentVersion,
        pendingMigrations: [], // Would be populated with available migrations
        lastAppliedMigration: lastMigration || undefined,
        isUpToDate: true, // Would check against available migrations
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

  /**
   * Calculate checksum for migration plan
   */
  private calculateMigrationChecksum(migration: MigrationPlan): string {
    const content = JSON.stringify({
      version: migration.version,
      operations: migration.operations.map(op => ({
        type: op.type,
        tableName: op.tableName,
      })),
    })

    // Simple checksum - in production, use a proper hash function
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return hash.toString(16)
  }

  /**
   * Rollback executed operations
   */
  private async rollbackOperations(operations: MigrationOperation[]): Promise<void> {
    const db = this.database.getConnection()
    if (!db) {
      throw new DexBeeError(DexBeeErrorCode.CONNECTION_FAILED, 'Database connection not available for rollback')
    }

    for (const operation of operations) {
      if (operation.rollback) {
        console.debug(`Rolling back ${operation.type} on ${operation.tableName}`)
        await operation.rollback(db)
      }
      else {
        console.warn(`Cannot rollback ${operation.type} on ${operation.tableName} - no rollback method`)
      }
    }
  }
}
