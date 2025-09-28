import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema, FieldDefinition } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class DropFieldOperation implements MigrationOperation {
  type = 'dropField' as const

  constructor(
    public tableName: string,
    public fieldName: string,
    private preservedFieldDefinition?: FieldDefinition,
  ) {}

  async execute(db: IDBDatabase): Promise<void> {
    try {
      // Check if table exists
      if (!db.objectStoreNames.contains(this.tableName)) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
          `Table '${this.tableName}' does not exist`,
        )
      }

      // Note: IndexedDB doesn't have a direct way to remove fields from existing records
      // This operation primarily affects schema validation for new records
      // Existing records will keep the field data until explicitly cleaned up

      console.warn(
        `Dropping field '${this.fieldName}' from table '${this.tableName}'. `
        + `Field will no longer be validated, but existing data will remain until cleaned up.`,
      )

      // If there was a unique index on this field, we should note that it will be removed
      if (this.preservedFieldDefinition?.unique) {
        console.info(
          `Unique constraint on field '${this.fieldName}' will no longer be enforced.`,
        )
      }
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to drop field '${this.fieldName}' from table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async rollback(db: IDBDatabase): Promise<void> {
    if (!this.preservedFieldDefinition) {
      throw new DexBeeError(
        DexBeeErrorCode.ROLLBACK_FAILED,
        `Cannot rollback field deletion for '${this.fieldName}' - original definition not preserved`,
      )
    }

    // Restore the field to schema validation
    console.info(
      `Rolling back deletion of field '${this.fieldName}' from table '${this.tableName}'. `
      + `Field validation will be restored.`,
    )
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in both schemas
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop field from table '${this.tableName}' - table does not exist in old schema`,
      )
    }

    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop field from table '${this.tableName}' - table does not exist in new schema`,
      )
    }

    // Check that the field exists in the old schema
    if (!oldSchema.tables[this.tableName].schema?.[this.fieldName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop field '${this.fieldName}' - it does not exist in table '${this.tableName}'`,
      )
    }

    // Check that the field doesn't exist in the new schema
    if (newSchema.tables[this.tableName].schema?.[this.fieldName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop field '${this.fieldName}' - it still exists in new schema for table '${this.tableName}'`,
      )
    }

    // Check if this is a primary key field
    if (oldSchema.tables[this.tableName].primaryKey === this.fieldName) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop field '${this.fieldName}' - it is the primary key for table '${this.tableName}'`,
      )
    }

    // Store the original field definition for potential rollback
    this.preservedFieldDefinition = oldSchema.tables[this.tableName].schema?.[this.fieldName]

    // Warn about data loss
    console.warn(
      `Dropping field '${this.fieldName}' from table '${this.tableName}' may result in data loss. `
      + `Consider data transformation or backup operations.`,
    )
  }
}
