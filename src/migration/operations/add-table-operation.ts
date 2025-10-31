import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema, TableConfig } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class AddTableOperation implements MigrationOperation {
  type = 'addTable' as const

  constructor(
    public tableName: string,
    public tableConfig: TableConfig,
  ) {}

  async execute(db: IDBDatabase): Promise<void> {
    try {
      // Check if table already exists
      if (db.objectStoreNames.contains(this.tableName)) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
          `Table '${this.tableName}' already exists`,
        )
      }

      // Create object store with proper configuration
      const storeOptions: IDBObjectStoreParameters = {}

      if (this.tableConfig.primaryKey) {
        storeOptions.keyPath = this.tableConfig.primaryKey
      }

      if (this.tableConfig.autoIncrement) {
        storeOptions.autoIncrement = true
      }

      const store = db.createObjectStore(this.tableName, storeOptions)

      // Create indexes if specified
      if (this.tableConfig.indexes) {
        for (const indexDef of this.tableConfig.indexes) {
          // Simple index creation - in a more sophisticated version,
          // we'd parse complex index definitions
          try {
            const indexName = typeof indexDef === 'string' ? indexDef : indexDef.name
            store.createIndex(indexName, indexName)
          }
          catch (error) {
            // Log warning but don't fail the migration for index issues
            console.warn(`Failed to create index on table '${this.tableName}':`, error)
          }
        }
      }

      // Create unique indexes based on schema field definitions
      if (this.tableConfig.schema) {
        for (const [fieldName, fieldDef] of Object.entries(this.tableConfig.schema)) {
          if (fieldDef.unique && fieldName !== this.tableConfig.primaryKey) {
            try {
              store.createIndex(`${fieldName}_unique`, fieldName, { unique: true })
            }
            catch (error) {
              console.warn(`Failed to create unique index for field '${fieldName}':`, error)
            }
          }
        }
      }
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to create table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table doesn't exist in the old schema
    if (oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add table '${this.tableName}' - it already exists in the old schema`,
      )
    }

    // Check that the table exists in the new schema
    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add table '${this.tableName}' - it does not exist in the new schema`,
      )
    }

    // Validate table configuration
    if (!this.tableConfig.schema || Object.keys(this.tableConfig.schema).length === 0) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Table '${this.tableName}' must have at least one field defined`,
      )
    }

    // Validate primary key if specified
    if (this.tableConfig.primaryKey) {
      if (!this.tableConfig.schema[this.tableConfig.primaryKey]) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
          `Primary key '${this.tableConfig.primaryKey}' for table '${this.tableName}' is not defined in schema`,
        )
      }
    }
  }
}
