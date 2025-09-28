import type { MigrationOperation } from '../../types/migration'
import type { DatabaseSchema } from '../../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../../types/errors'

export class AddIndexOperation implements MigrationOperation {
  type = 'addIndex' as const

  constructor(
    public tableName: string,
    public indexName: string,
    public keyPath: string | string[],
    public options?: IDBIndexParameters,
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

      // Note: This operation must be performed within a version change transaction
      // In the context of IndexedDB, indexes can only be created during database upgrade
      console.warn(
        `Adding index '${this.indexName}' to table '${this.tableName}'. `
        + `This operation must be performed during database version upgrade.`,
      )

      // In a real implementation, this would be handled by the migration manager
      // during the database upgrade process
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to add index '${this.indexName}' to table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async rollback(db: IDBDatabase): Promise<void> {
    console.info(
      `Rolling back addition of index '${this.indexName}' from table '${this.tableName}'.`,
    )
    // The rollback would involve removing the index during a version change
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in both schemas
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add index to table '${this.tableName}' - table does not exist in old schema`,
      )
    }

    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot add index to table '${this.tableName}' - table does not exist in new schema`,
      )
    }

    // Validate that the key path exists in the schema
    if (typeof this.keyPath === 'string') {
      if (!newSchema.tables[this.tableName].schema?.[this.keyPath]) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
          `Cannot create index on field '${this.keyPath}' - field does not exist in table '${this.tableName}'`,
        )
      }
    }
    else {
      // Compound index
      for (const field of this.keyPath) {
        if (!newSchema.tables[this.tableName].schema?.[field]) {
          throw new DexBeeError(
            DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
            `Cannot create compound index - field '${field}' does not exist in table '${this.tableName}'`,
          )
        }
      }
    }

    // Validate index name uniqueness
    const existingIndexes = oldSchema.tables[this.tableName].indexes || []
    if (existingIndexes.some(index => index.name === this.indexName)) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Index '${this.indexName}' already exists on table '${this.tableName}'`,
      )
    }
  }
}

export class DropIndexOperation implements MigrationOperation {
  type = 'dropIndex' as const

  constructor(
    public tableName: string,
    public indexName: string,
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

      console.info(
        `Dropping index '${this.indexName}' from table '${this.tableName}'.`,
      )
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_EXECUTION_FAILED,
        `Failed to drop index '${this.indexName}' from table '${this.tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async rollback(db: IDBDatabase): Promise<void> {
    console.info(
      `Rolling back deletion of index '${this.indexName}' for table '${this.tableName}'.`,
    )
    // Would recreate the index during version change
  }

  validate(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): void {
    // Check that the table exists in both schemas
    if (!oldSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop index from table '${this.tableName}' - table does not exist in old schema`,
      )
    }

    if (!newSchema.tables[this.tableName]) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop index from table '${this.tableName}' - table does not exist in new schema`,
      )
    }

    // Check that the index exists in the old schema
    const existingIndexes = oldSchema.tables[this.tableName].indexes || []
    if (!existingIndexes.some(index => index.name === this.indexName)) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop index '${this.indexName}' - it does not exist on table '${this.tableName}'`,
      )
    }

    // Check that the index doesn't exist in the new schema
    const newIndexes = newSchema.tables[this.tableName].indexes || []
    if (newIndexes.some(index => index.name === this.indexName)) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
        `Cannot drop index '${this.indexName}' - it still exists in new schema for table '${this.tableName}'`,
      )
    }
  }
}
