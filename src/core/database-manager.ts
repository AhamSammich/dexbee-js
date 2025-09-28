import type { DatabaseSchema, TableConfig } from '../types/schema.js'
import type { IDatabaseManager } from './interfaces.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'

export class DatabaseManager implements IDatabaseManager {
  private db: IDBDatabase | null = null
  private connectionPromise: Promise<IDBDatabase> | null = null

  constructor(
    private dbName: string,
    private version: number,
    private schema: DatabaseSchema,
  ) {
    if (!dbName || version < 1) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'Invalid database name or version',
      )
    }
  }

  async connect(): Promise<IDBDatabase> {
    if (this.db && this.db.version === this.version) {
      return this.db
    }

    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = this.establishConnection()

    try {
      this.db = await this.connectionPromise
      this.setupEventHandlers(this.db)
      return this.db
    }
    finally {
      this.connectionPromise = null
    }
  }

  private establishConnection(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new DexBeeError(
          DexBeeErrorCode.CONNECTION_FAILED,
          `Failed to open database: ${request.error?.message}`,
          request.error || undefined,
        ))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = request.result
        const transaction = request.transaction

        if (!transaction) {
          reject(new DexBeeError(
            DexBeeErrorCode.CONNECTION_FAILED,
            'No transaction available during upgrade',
          ))
          return
        }

        try {
          this.applySchemaUpgrade(db, event.oldVersion, event.newVersion || this.version)
        }
        catch (error) {
          transaction.abort()
          reject(new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            'Failed to apply schema upgrade',
            error as Error,
          ))
        }
      }

      request.onblocked = () => {
        console.warn('Database upgrade blocked. Close other connections.')
      }
    })
  }

  private applySchemaUpgrade(db: IDBDatabase, oldVersion: number, newVersion: number): void {
    // For now, create all object stores for the current schema
    // Later this will be enhanced with proper migration logic
    Object.entries(this.schema.tables).forEach(([tableName, config]) => {
      if (!db.objectStoreNames.contains(tableName)) {
        this.createObjectStore(db, tableName, config)
      }
    })
  }

  private createObjectStore(db: IDBDatabase, name: string, config: TableConfig): void {
    const storeOptions: IDBObjectStoreParameters = {}

    if (config.primaryKey) {
      storeOptions.keyPath = config.primaryKey
    }

    if (config.autoIncrement) {
      storeOptions.autoIncrement = true
    }

    const store = db.createObjectStore(name, storeOptions)

    // Create indexes
    if (config.indexes) {
      config.indexes.forEach((index) => {
        store.createIndex(index.name, index.keyPath, {
          unique: index.unique || false,
          multiEntry: index.multiEntry || false,
        })
      })
    }
  }

  private setupEventHandlers(db: IDBDatabase): void {
    db.onclose = () => {
      console.warn('Database connection closed unexpectedly')
      this.db = null
    }

    db.onerror = (event) => {
      console.error('Database error:', event)
    }

    db.onversionchange = () => {
      console.warn('Database version changed by another connection')
      db.close()
      this.db = null
    }
  }

  isConnected(): boolean {
    return this.db !== null && this.db.version === this.version
  }

  getConnection(): IDBDatabase {
    if (!this.db) {
      throw new DexBeeError(
        DexBeeErrorCode.CONNECTION_FAILED,
        'No active database connection. Call connect() first.',
      )
    }
    return this.db
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
