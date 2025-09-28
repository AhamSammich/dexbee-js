import type { DatabaseSchema, Migration } from '../types/schema.js'
import type { TransactionOptions } from '../types/transaction.js'

export interface IDatabaseManager {
  connect: () => Promise<IDBDatabase>
  close: () => void
  isConnected: () => boolean
  getConnection: () => IDBDatabase
}

export interface ISchemaManager {
  validateSchema: () => void
  applyMigrations: (db: IDBDatabase, oldVersion: number, newVersion: number) => void
  generateMigration: (oldSchema: DatabaseSchema, newSchema: DatabaseSchema) => Migration
}

export interface ITransactionWrapper {
  getStore: (name: string) => IDBObjectStore
  commit: () => Promise<void>
  abort: () => Promise<void>
  isCompleted: () => boolean
  getMode: () => IDBTransactionMode
}

export interface ITransactionManager {
  withTransaction: <T>(
    options: TransactionOptions,
    callback: (tx: ITransactionWrapper) => Promise<T>
  ) => Promise<T>

  withReadTransaction: <T>(
    stores: string[],
    callback: (tx: ITransactionWrapper) => Promise<T>
  ) => Promise<T>

  withWriteTransaction: <T>(
    stores: string[],
    callback: (tx: ITransactionWrapper) => Promise<T>
  ) => Promise<T>

  abortAllTransactions: () => Promise<void>
  getActiveTransactionCount: () => number
}

export interface IDatabase {
  connect: () => Promise<void>
  close: () => void
  isConnected: () => boolean
  transaction: (options: TransactionOptions) => Promise<ITransactionWrapper>
}
