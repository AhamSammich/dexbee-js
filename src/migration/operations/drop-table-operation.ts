import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class DropTableOperation implements MigrationOperation {
  type = 'dropTable' as const

  constructor(
    public tableName: string,
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

      // Delete the object store
      db.deleteObjectStore(this.tableName)
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to drop table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in the old schema
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop table '${this.tableName}' - it does not exist in the old schema`,
      )
    }

    // Check that the table doesn't exist in the new schema
    if (newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop table '${this.tableName}' - it still exists in the new schema`,
      )
    }
  }
}
