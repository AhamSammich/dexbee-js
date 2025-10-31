import type { DataTransformation, MigrationOperation, TransformOptions } from '../../types/migration'
import type { DatabaseSchema } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'
import { DataTransformer } from '../data-transformer'

export class TransformDataOperation implements MigrationOperation {
  type = 'transformData' as const
  private dataTransformer: DataTransformer

  constructor(
    public tableName: string,
    public transformation: DataTransformation,
    public options: TransformOptions = {},
  ) {
    this.dataTransformer = new DataTransformer()
  }

  async execute(db: IDBDatabase): Promise<void> {
    try {
      // Check if table exists
      if (!db.objectStoreNames.contains(this.tableName)) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
          `Table '${this.tableName}' does not exist`,
        )
      }

      console.info(`Starting data transformation for table '${this.tableName}'`)

      // Validate transformation before applying
      const validationResult = await this.dataTransformer.validateTransformation(
        this.tableName,
        this.transformation,
      )

      if (!validationResult.isValid) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
          `Transformation validation failed: ${validationResult.errors.join(', ')}`,
        )
      }

      // Apply the transformation
      const result = await this.dataTransformer.transformTable(
        this.tableName,
        this.transformation,
        this.options,
      )

      if (!result.success) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
          `Data transformation failed: ${result.errors.map(e => e.message).join(', ')}`,
        )
      }

      console.info(
        `Data transformation completed: ${result.recordsTransformed}/${result.recordsProcessed} records transformed in ${result.duration}ms`,
      )
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to transform data in table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in both schemas
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot transform data in table '${this.tableName}' - table does not exist in old schema`,
      )
    }

    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot transform data in table '${this.tableName}' - table does not exist in new schema`,
      )
    }

    // Validate transformation functions
    if (!this.transformation.transform || typeof this.transformation.transform !== 'function') {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        'Data transformation must include a transform function',
      )
    }

    if (this.transformation.filter && typeof this.transformation.filter !== 'function') {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        'Data transformation filter must be a function',
      )
    }

    if (this.transformation.validate && typeof this.transformation.validate !== 'function') {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        'Data transformation validate must be a function',
      )
    }

    // Warn about potential data loss
    console.warn(
      `Data transformation for table '${this.tableName}' may modify existing data. `
      + `Ensure you have backups before proceeding.`,
    )
  }
}
