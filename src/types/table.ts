/**
 * Configuration options for Table instances
 */
export interface TableOptions {
  /**
   * Enable automatic operation queuing to prevent race conditions.
   * When enabled, operations on the same record execute sequentially.
   * @default true
   */
  queueOperations?: boolean
}
