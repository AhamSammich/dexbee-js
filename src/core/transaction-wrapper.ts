import type { TransactionOptions } from '../types/transaction.js'
import type { ITransactionWrapper } from './interfaces.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'

export class TransactionWrapper implements ITransactionWrapper {
  private transaction: IDBTransaction
  private isActive: boolean = true
  private completionPromise: Promise<void>

  constructor(
    private db: IDBDatabase,
    private options: TransactionOptions,
  ) {
    this.transaction = this.db.transaction(
      this.options.stores,
      this.options.mode || 'readonly',
    )

    this.completionPromise = this.setupEventHandlers()
  }

  static async create(db: IDBDatabase, options: TransactionOptions): Promise<TransactionWrapper> {
    const wrapper = new TransactionWrapper(db, options)
    return wrapper
  }

  getStore(name: string): IDBObjectStore {
    if (!this.isActive) {
      throw new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        'Transaction is no longer active',
      )
    }

    if (!this.options.stores.includes(name)) {
      throw new DexBeeError(
        DexBeeErrorCode.STORE_NOT_FOUND,
        `Store '${name}' is not available in this transaction. Available stores: ${this.options.stores.join(', ')}`,
      )
    }

    try {
      return this.transaction.objectStore(name)
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.STORE_NOT_FOUND,
        `Failed to access store '${name}'`,
        error as Error,
      )
    }
  }

  async commit(): Promise<void> {
    if (!this.isActive) {
      throw new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        'Transaction is no longer active',
      )
    }

    // In modern browsers, transactions auto-commit
    // We can manually commit if supported
    if ('commit' in this.transaction && typeof this.transaction.commit === 'function') {
      this.transaction.commit()
    }

    return this.completionPromise
  }

  async abort(): Promise<void> {
    if (!this.isActive) {
      return // Already completed
    }

    this.transaction.abort()
    return this.completionPromise
  }

  isCompleted(): boolean {
    return !this.isActive
  }

  getMode(): IDBTransactionMode {
    return this.transaction.mode
  }

  private setupEventHandlers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.transaction.oncomplete = () => {
        this.isActive = false
        resolve()
      }

      this.transaction.onabort = () => {
        this.isActive = false
        const error = this.transaction.error
        if (error) {
          reject(new DexBeeError(
            DexBeeErrorCode.TRANSACTION_FAILED,
            'Transaction was aborted',
            error,
          ))
        }
        else {
          resolve() // Manual abort
        }
      }

      this.transaction.onerror = () => {
        this.isActive = false
        reject(new DexBeeError(
          DexBeeErrorCode.TRANSACTION_FAILED,
          'Transaction failed',
          this.transaction.error || undefined,
        ))
      }
    })
  }
}
