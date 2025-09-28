import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema, FieldDefinition } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class AddFieldOperation implements MigrationOperation {
  type = 'addField' as const

  constructor(
    public tableName: string,
    public fieldName: string,
    public fieldDefinition: FieldDefinition,
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

      // Note: IndexedDB doesn't have a direct way to add fields to existing records
      // This operation primarily affects schema validation and new records
      // Existing records will have undefined for this field until explicitly updated

      // If the field should have a unique index, we need to handle this carefully
      if (this.fieldDefinition.unique) {
        // We would need to be in a version change transaction to create indexes
        // For now, log a warning that unique constraint will be enforced going forward
        console.warn(
          `Adding unique field '${this.fieldName}' to table '${this.tableName}'. `
          + `Unique constraint will only apply to new records.`,
        )
      }

      // If the field has a default value, we might want to update existing records
      if (this.fieldDefinition.default !== undefined) {
        console.info(
          `Field '${this.fieldName}' added with default value. `
          + `Existing records will need to be updated separately if desired.`,
        )
      }
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to add field '${this.fieldName}' to table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async rollback(db: IDBDatabase): Promise<void> {
    // Note: Since IndexedDB doesn't enforce field schemas at the database level,
    // rolling back a field addition primarily means removing it from our schema definition
    // Existing records with this field would need to be cleaned up manually

    console.warn(
      `Rolling back addition of field '${this.fieldName}' from table '${this.tableName}'. `
      + `Field will no longer be validated, but existing data with this field will remain.`,
    )
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in both schemas
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add field to table '${this.tableName}' - table does not exist in old schema`,
      )
    }

    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add field to table '${this.tableName}' - table does not exist in new schema`,
      )
    }

    // Check that the field doesn't exist in the old schema
    if (oldSchema.tables[this.tableName].schema?.[this.fieldName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add field '${this.fieldName}' - it already exists in table '${this.tableName}'`,
      )
    }

    // Check that the field exists in the new schema
    if (!newSchema.tables[this.tableName].schema?.[this.fieldName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add field '${this.fieldName}' - it does not exist in new schema for table '${this.tableName}'`,
      )
    }

    // Validate field definition
    if (!this.fieldDefinition.type) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Field '${this.fieldName}' must have a type defined`,
      )
    }

    // Warn about potentially problematic configurations
    if (this.fieldDefinition.required && this.fieldDefinition.default === undefined) {
      console.warn(
        `Adding required field '${this.fieldName}' without a default value. `
        + `Existing records may fail validation until updated.`,
      )
    }
  }
}
