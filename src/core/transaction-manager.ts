import type { TransactionOptions } from '../types/transaction.js'
import type { ITransactionManager, ITransactionWrapper } from './interfaces.js'
import { TransactionWrapper } from './transaction-wrapper.js'

export class TransactionManager implements ITransactionManager {
  private activeTransactions: Set<TransactionWrapper> = new Set()

  constructor(private db: IDBDatabase) {}

  async withTransaction<T>(
    options: TransactionOptions,
    callback: (tx: ITransactionWrapper) => Promise<T>,
  ): Promise<T> {
    const tx = await TransactionWrapper.create(this.db, options)
    this.registerTransaction(tx)

    try {
      const result = await callback(tx)

      // If transaction is still active, commit it
      if (!tx.isCompleted()) {
        await tx.commit()
      }

      return result
    }
    catch (error) {
      // If transaction is still active, abort it
      if (!tx.isCompleted()) {
        try {
          await tx.abort()
        }
        catch (abortError) {
          console.warn('Failed to abort transaction:', abortError)
        }
      }
      throw error
    }
    finally {
      this.unregisterTransaction(tx)
    }
  }

  async withReadTransaction<T>(
    stores: string[],
    callback: (tx: ITransactionWrapper) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(
      { stores, mode: 'readonly' },
      callback,
    )
  }

  async withWriteTransaction<T>(
    stores: string[],
    callback: (tx: ITransactionWrapper) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(
      { stores, mode: 'readwrite' },
      callback,
    )
  }

  async abortAllTransactions(): Promise<void> {
    const abortPromises: Promise<void>[] = []

    for (const tx of this.activeTransactions) {
      if (!tx.isCompleted()) {
        abortPromises.push(tx.abort().catch((error) => {
          console.warn('Failed to abort transaction:', error)
        }))
      }
    }

    await Promise.allSettled(abortPromises)
    this.activeTransactions.clear()
  }

  getActiveTransactionCount(): number {
    // Clean up completed transactions
    for (const tx of this.activeTransactions) {
      if (tx.isCompleted()) {
        this.activeTransactions.delete(tx)
      }
    }

    return this.activeTransactions.size
  }

  private registerTransaction(tx: TransactionWrapper): void {
    this.activeTransactions.add(tx)
  }

  private unregisterTransaction(tx: TransactionWrapper): void {
    this.activeTransactions.delete(tx)
  }
}
