import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class DropTableOperation implements MigrationOperation {
  type = 'dropTable' as const

  constructor(
    public tableName: string,
    private preservedTableConfig?: any, // Store original config for rollback
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

  async rollback(db: IDBDatabase): Promise<void> {
    if (!this.preservedTableConfig) {
      throw new DexBeeError(
        DexBeeErrorCode.ROLLBACK_FAILED,
        `Cannot rollback table deletion for '${this.tableName}' - original configuration not preserved`,
      )
    }

    try {
      // Recreate the table with its original configuration
      const storeOptions: IDBObjectStoreParameters = {}

      if (this.preservedTableConfig.primaryKey) {
        storeOptions.keyPath = this.preservedTableConfig.primaryKey
      }

      if (this.preservedTableConfig.autoIncrement) {
        storeOptions.autoIncrement = true
      }

      const store = db.createObjectStore(this.tableName, storeOptions)

      // Recreate indexes if they existed
      if (this.preservedTableConfig.indexes) {
        for (const indexName of this.preservedTableConfig.indexes) {
          try {
            store.createIndex(indexName, indexName)
          }
          catch (error) {
            console.warn(`Failed to recreate index '${indexName}' during rollback:`, error)
          }
        }
      }

      // Recreate unique indexes
      if (this.preservedTableConfig.schema) {
        for (const [fieldName, fieldDef] of Object.entries(this.preservedTableConfig.schema)) {
          if ((fieldDef as any).unique && fieldName !== this.preservedTableConfig.primaryKey) {
            try {
              store.createIndex(`${fieldName}_unique`, fieldName, { unique: true })
            }
            catch (error) {
              console.warn(`Failed to recreate unique index for field '${fieldName}' during rollback:`, error)
            }
          }
        }
      }

      // Note: Data cannot be restored without a backup system
      console.warn(`Table '${this.tableName}' structure restored, but data was lost`)
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.ROLLBACK_FAILED,
        `Failed to rollback table deletion for '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
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

    // Store the original configuration for potential rollback
    this.preservedTableConfig = oldSchema.tables[this.tableName]
  }
}
