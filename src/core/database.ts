import type {
  DryRunResult,
  MigrationOptions,
  MigrationResult,
  MigrationStatus,
  RollbackResult,
} from '../types/migration.js'
import type { DatabaseSchema } from '../types/schema.js'
import type { TransactionOptions } from '../types/transaction.js'
import type { IDatabase, ITransactionWrapper } from './interfaces.js'
import { Table } from '../query/table.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'
import { DatabaseManager } from './database-manager.js'
import { MigrationManager } from './migration-manager.js'
import { SchemaManager } from './schema-manager.js'
import { TransactionManager } from './transaction-manager.js'

export class Database implements IDatabase {
  private connectionManager: DatabaseManager
  private schemaManager: SchemaManager
  private transactionManager: TransactionManager | null = null
  private migrationManager: MigrationManager | null = null
  private tableCache: Map<string, Table> = new Map()
  private dbName: string

  constructor(name: string, schema: DatabaseSchema) {
    this.dbName = name

    // Validate schema during construction
    this.schemaManager = new SchemaManager(schema)
    this.schemaManager.validateSchema()

    this.connectionManager = new DatabaseManager(name, schema.version, schema)
  }

  async connect(): Promise<void> {
    const db = await this.connectionManager.connect()
    this.transactionManager = new TransactionManager(db)
    this.migrationManager = new MigrationManager(this, this.dbName)
  }

  close(): void {
    if (this.transactionManager) {
      // Abort any active transactions
      this.transactionManager.abortAllTransactions().catch((error) => {
        console.warn('Error aborting transactions during close:', error)
      })
      this.transactionManager = null
    }

    this.connectionManager.close()
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected()
  }

  async transaction(options: TransactionOptions): Promise<ITransactionWrapper> {
    if (!this.transactionManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    const db = this.connectionManager.getConnection()
    const { TransactionWrapper } = await import('./transaction-wrapper.js')
    return TransactionWrapper.create(db, options)
  }

  // Convenience methods that delegate to the transaction manager
  async withTransaction<T>(
    options: TransactionOptions,
    callback: (tx: ITransactionWrapper) => Promise<T>,
  ): Promise<T> {
    if (!this.transactionManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    return this.transactionManager.withTransaction(options, callback)
  }

  async withReadTransaction<T>(
    stores: string[],
    callback: (tx: ITransactionWrapper) => Promise<T>,
  ): Promise<T> {
    if (!this.transactionManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    return this.transactionManager.withReadTransaction(stores, callback)
  }

  async withWriteTransaction<T>(
    stores: string[],
    callback: (tx: ITransactionWrapper) => Promise<T>,
  ): Promise<T> {
    if (!this.transactionManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    return this.transactionManager.withWriteTransaction(stores, callback)
  }

  // Data validation methods that delegate to the schema manager
  validateData(tableName: string, data: any): void {
    return this.schemaManager.validateData(tableName, data)
  }

  applyDefaults(tableName: string, data: any): any {
    return this.schemaManager.applyDefaults(tableName, data)
  }

  // Utility methods for database state
  getActiveTransactionCount(): number {
    return this.transactionManager?.getActiveTransactionCount() || 0
  }

  async abortAllTransactions(): Promise<void> {
    if (this.transactionManager) {
      return this.transactionManager.abortAllTransactions()
    }
  }

  // Query builder interface - provides access to Table instances
  table<T = any>(tableName: string): Table<T> {
    if (!this.tableCache.has(tableName)) {
      const table = new Table<T>(
        tableName,
        this.getTransactionFunction(),
        this.schemaManager.schema, // Access schema from SchemaManager
        this.schemaManager.applyDefaults.bind(this.schemaManager),
        this.schemaManager.validateData.bind(this.schemaManager),
      )
      this.tableCache.set(tableName, table)
    }
    return this.tableCache.get(tableName)! as Table<T>
  }

  private getTransactionFunction() {
    return async (stores: string[], mode: 'readonly' | 'readwrite'): Promise<ITransactionWrapper> => {
      if (!this.transactionManager) {
        throw new DexBeeError(
          DexBeeErrorCode.CONNECTION_FAILED,
          'Database is not connected. Call connect() first.',
        )
      }

      const db = this.connectionManager.getConnection()
      const { TransactionWrapper } = await import('./transaction-wrapper.js')

      return TransactionWrapper.create(db, {
        stores,
        mode: mode as 'readonly' | 'readwrite',
      })
    }
  }

  // Migration methods
  async migrate(newSchema: DatabaseSchema, options?: MigrationOptions): Promise<MigrationResult> {
    if (!this.migrationManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    const currentSchema = this.schemaManager.schema
    const migrationPlan = await this.migrationManager.generateMigration(
      currentSchema,
      newSchema,
      options,
    )

    const result = await this.migrationManager.applyMigration(migrationPlan, options)

    // Update schema manager with new schema if migration was successful
    if (result.success) {
      this.schemaManager = new SchemaManager(newSchema)
      this.tableCache.clear() // Clear table cache to use new schema
    }

    return result
  }

  async rollback(targetVersion: number): Promise<RollbackResult> {
    if (!this.migrationManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    return this.migrationManager.rollback(targetVersion)
  }

  async dryRunMigration(newSchema: DatabaseSchema, options?: MigrationOptions): Promise<DryRunResult> {
    if (!this.migrationManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    const currentSchema = this.schemaManager.schema
    const migrationPlan = await this.migrationManager.generateMigration(
      currentSchema,
      newSchema,
      options,
    )

    return this.migrationManager.dryRun(migrationPlan)
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    if (!this.migrationManager) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Database is not connected. Call connect() first.',
      )
    }

    return this.migrationManager.getMigrationStatus()
  }

  // Internal method for migration manager to access connection
  getConnection(): IDBDatabase | null {
    return this.connectionManager.getConnection()
  }

  // Get current schema
  getSchema(): DatabaseSchema {
    return this.schemaManager.schema
  }
}
