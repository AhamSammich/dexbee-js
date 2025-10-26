/**
 * Manages per-record operation queuing to prevent race conditions.
 * Each record ID gets its own queue, allowing parallel execution across different records
 * while ensuring sequential execution for the same record.
 *
 * @example
 * ```typescript
 * const queue = new OperationQueue()
 *
 * // These execute sequentially for the same ID
 * await Promise.all([
 *   queue.add('user-1', async () => updateUser('user-1', { count: 1 })),
 *   queue.add('user-1', async () => updateUser('user-1', { count: 2 })),
 * ])
 *
 * // These execute in parallel (different IDs)
 * await Promise.all([
 *   queue.add('user-1', async () => updateUser('user-1', { count: 1 })),
 *   queue.add('user-2', async () => updateUser('user-2', { count: 1 })),
 * ])
 * ```
 */
export class OperationQueue {
  /** Map of record ID to the promise chain for that record */
  private queues = new Map<string, Promise<any>>()

  /** Flag to track if queue is enabled */
  private enabled: boolean

  constructor(enabled: boolean = true) {
    this.enabled = enabled
  }

  /**
   * Adds an operation to the queue for a specific record ID.
   * Operations for the same ID execute sequentially.
   * Operations for different IDs execute in parallel.
   *
   * @param key - The record ID to queue operations for
   * @param operation - The async operation to execute
   * @returns Promise resolving to the operation result
   *
   * @example
   * ```typescript
   * const result = await queue.add('user-123', async () => {
   *   const user = await getUser('user-123')
   *   user.count++
   *   await saveUser(user)
   *   return user
   * })
   * ```
   */
  async add<T>(key: string | number, operation: () => Promise<T>): Promise<T> {
    // If queue is disabled, execute immediately
    if (!this.enabled) {
      return operation()
    }

    // Convert key to string for map storage
    const stringKey = String(key)

    // Get existing promise chain for this key, or start a new one
    const existing = this.queues.get(stringKey) || Promise.resolve()

    // Chain the new operation
    const queued = existing
      .then(() => operation())
      .catch((error) => {
        // Re-throw the error but don't break the queue chain
        throw error
      })

    // Update the queue with the new promise
    this.queues.set(stringKey, queued)

    // Clean up completed operations
    return queued.finally(() => {
      // Only delete if this is still the latest operation in the queue
      if (this.queues.get(stringKey) === queued) {
        this.queues.delete(stringKey)
      }
    })
  }

  /**
   * Clears all queued operations.
   * CAUTION: This does not abort in-flight operations, it just clears references.
   */
  clear(): void {
    this.queues.clear()
  }

  /**
   * Gets the number of records with pending operations.
   *
   * @returns The count of unique record IDs with queued operations
   */
  getPendingCount(): number {
    return this.queues.size
  }

  /**
   * Checks if a specific record has pending operations.
   *
   * @param key - The record ID to check
   * @returns True if the record has pending operations
   */
  hasPending(key: string | number): boolean {
    return this.queues.has(String(key))
  }

  /**
   * Enables or disables the queue.
   * When disabled, operations execute immediately without queuing.
   *
   * @param enabled - Whether to enable queuing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Checks if queue is enabled.
   *
   * @returns True if queuing is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }
}
