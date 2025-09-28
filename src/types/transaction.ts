export type TransactionMode = 'readonly' | 'readwrite'

export interface TransactionOptions {
  mode?: TransactionMode
  stores: string[]
  autoCommit?: boolean
  timeout?: number
}

export interface TransactionResult<T = any> {
  success: boolean
  data?: T
  error?: Error
}
