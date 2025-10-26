import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema, FieldDefinition } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class AlterFieldOperation implements MigrationOperation {
  type = 'alterField' as const

  constructor(
    public tableName: string,
    public fieldName: string,
    public oldDefinition: FieldDefinition,
    public newDefinition: FieldDefinition,
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

      // Analyze the changes
      const changes = this.analyzeChanges()

      // Log the changes being made
      console.info(
        `Altering field '${this.fieldName}' in table '${this.tableName}':`,
        changes,
      )

      // Handle type changes
      if (changes.typeChanged) {
        console.warn(
          `Changing type of field '${this.fieldName}' from '${this.oldDefinition.type}' to '${this.newDefinition.type}'. `
          + `Existing data may need validation or transformation.`,
        )
      }

      // Handle required field changes
      if (changes.requiredChanged) {
        if (this.newDefinition.required && !this.oldDefinition.required) {
          console.warn(
            `Making field '${this.fieldName}' required. Existing records without this field may fail validation.`,
          )
        }
        else {
          console.info(`Making field '${this.fieldName}' optional.`)
        }
      }

      // Handle unique constraint changes
      if (changes.uniqueChanged) {
        if (this.newDefinition.unique && !this.oldDefinition.unique) {
          console.warn(
            `Adding unique constraint to field '${this.fieldName}'. `
            + `Existing duplicate values may cause constraint violations.`,
          )
        }
        else {
          console.info(
            `Removing unique constraint from field '${this.fieldName}'.`,
          )
        }
      }

      // Handle default value changes
      if (changes.defaultChanged) {
        console.info(
          `Changing default value for field '${this.fieldName}' from '${this.oldDefinition.default}' to '${this.newDefinition.default}'.`,
        )
      }

      // Handle nullable constraint changes
      if (changes.nullableChanged) {
        if (this.newDefinition.nullable === false && this.oldDefinition.nullable !== false) {
          console.warn(
            `Making field '${this.fieldName}' non-nullable. Existing null values may cause validation errors.`,
          )
        }
        else if (this.newDefinition.nullable === true && this.oldDefinition.nullable === false) {
          console.info(`Making field '${this.fieldName}' nullable.`)
        }
      }
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to alter field '${this.fieldName}' in table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async rollback(db: IDBDatabase): Promise<void> {
    // Rollback by "altering" back to the old definition
    console.info(
      `Rolling back field alteration for '${this.fieldName}' in table '${this.tableName}' to original definition.`,
    )

    // The rollback is essentially the reverse operation
    // We restore the original field definition
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in both schemas
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot alter field in table '${this.tableName}' - table does not exist in old schema`,
      )
    }

    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot alter field in table '${this.tableName}' - table does not exist in new schema`,
      )
    }

    // Check that the field exists in both schemas
    if (!oldSchema.tables[this.tableName].schema?.[this.fieldName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot alter field '${this.fieldName}' - it does not exist in old schema for table '${this.tableName}'`,
      )
    }

    if (!newSchema.tables[this.tableName].schema?.[this.fieldName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot alter field '${this.fieldName}' - it does not exist in new schema for table '${this.tableName}'`,
      )
    }

    // Validate that the changes are reasonable
    const changes = this.analyzeChanges()

    // Check for potentially dangerous changes
    if (changes.typeChanged) {
      const isCompatible = this.areTypesCompatible(
        this.oldDefinition.type,
        this.newDefinition.type,
      )

      if (!isCompatible) {
        console.warn(
          `Type change from '${this.oldDefinition.type}' to '${this.newDefinition.type}' `
          + `for field '${this.fieldName}' may cause data loss or validation errors.`,
        )
      }
    }

    // Validate primary key changes
    if (oldSchema.tables[this.tableName].primaryKey === this.fieldName) {
      if (
        changes.typeChanged
        || (changes.requiredChanged && !this.newDefinition.required)
        || (changes.nullableChanged && this.newDefinition.nullable === true)
      ) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
          `Cannot alter primary key field '${this.fieldName}' in ways that affect its key properties`,
        )
      }
    }
  }

  private analyzeChanges(): {
    typeChanged: boolean
    requiredChanged: boolean
    uniqueChanged: boolean
    defaultChanged: boolean
    nullableChanged: boolean
  } {
    return {
      typeChanged: this.oldDefinition.type !== this.newDefinition.type,
      requiredChanged:
        this.oldDefinition.required !== this.newDefinition.required,
      uniqueChanged: this.oldDefinition.unique !== this.newDefinition.unique,
      defaultChanged: this.oldDefinition.default !== this.newDefinition.default,
      nullableChanged: this.oldDefinition.nullable !== this.newDefinition.nullable,
    }
  }

  private areTypesCompatible(oldType: string, newType: string): boolean {
    // Define type compatibility rules
    const compatibilityMap: Record<string, string[]> = {
      string: ['string'],
      number: ['number'],
      boolean: ['boolean'],
      date: ['date', 'string'], // Date can be converted to string
      object: ['object'],
      array: ['array'],
    }

    return compatibilityMap[oldType]?.includes(newType) ?? false
  }
}
