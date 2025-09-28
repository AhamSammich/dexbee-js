import type { ITransactionWrapper } from '../core/interfaces.js'
import type { QueryBuilder } from './query-builder.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'
import { createQueryBuilder } from './query-builder.js'

export class Table<T = any> {
  private queryBuilder: QueryBuilder<T>

  constructor(
    public readonly name: string,
    private getTransaction: (stores: string[], mode: 'readonly' | 'readwrite') => Promise<ITransactionWrapper>,
    private schema: import('../types/schema.js').DatabaseSchema,
    private applyDefaults?: (tableName: string, data: any) => any,
    private validateData?: (tableName: string, data: any) => void,
  ) {
    this.queryBuilder = createQueryBuilder<T>(name, getTransaction, schema)
  }

  // Query builder methods - these create new QueryBuilder instances
  select<K extends keyof T>(...fields: K[]): QueryBuilder<Pick<T, K>> {
    return this.queryBuilder.select(...fields)
  }

  where(condition: import('../types/query.js').WhereCondition<T>): QueryBuilder<T> {
    return this.queryBuilder.where(condition)
  }

  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    return this.queryBuilder.orderBy(field, direction)
  }

  limit(count: number): QueryBuilder<T> {
    return this.queryBuilder.limit(count)
  }

  offset(count: number): QueryBuilder<T> {
    return this.queryBuilder.offset(count)
  }

  // Relationship methods
  include(relationshipName: string, options?: Partial<import('../types/query.js').RelationshipQuery>): QueryBuilder<T> {
    return this.queryBuilder.include(relationshipName, options)
  }

  with(relationshipName: string, options?: Partial<import('../types/query.js').RelationshipQuery>): QueryBuilder<T> {
    return this.queryBuilder.with(relationshipName, options)
  }

  // Grouping methods
  groupBy(...fields: (keyof T)[]): QueryBuilder<T> {
    return this.queryBuilder.groupBy(...fields)
  }

  having(condition: import('../types/query.js').WhereCondition<any>): QueryBuilder<T> {
    return this.queryBuilder.having(condition)
  }

  // Direct execution methods for simple queries
  async all(): Promise<T[]> {
    return this.queryBuilder.all()
  }

  async first(): Promise<T | null> {
    return this.queryBuilder.first()
  }

  async count(): Promise<number> {
    return this.queryBuilder.count()
  }

  // Aggregation methods
  async sum(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.sum(field)
  }

  async avg(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.avg(field)
  }

  async max(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.max(field)
  }

  async min(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.min(field)
  }

  async aggregate(fn: 'sum' | 'avg' | 'max' | 'min' | 'count', field?: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.aggregate(fn, field)
  }

  // CRUD operations that work directly with transactions
  async findById(id: any): Promise<T | null> {
    const tx = await this.getTransaction([this.name], 'readonly')
    const store = tx.getStore(this.name)

    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Failed to find record with ID ${id}: ${request.error?.message}`,
        request.error || undefined,
      ))
    })
  }

  async insert(data: Partial<T>): Promise<T> {
    const tx = await this.getTransaction([this.name], 'readwrite')
    const store = tx.getStore(this.name)

    return new Promise((resolve, reject) => {
      // Apply defaults and validate if available
      let processedData = data
      if (this.applyDefaults) {
        processedData = this.applyDefaults(this.name, data)
      }
      if (this.validateData) {
        this.validateData(this.name, processedData)
      }

      const request = store.add(processedData)
      request.onsuccess = () => {
        // Retrieve the inserted record with auto-generated fields
        const getRequest = store.get(request.result)
        getRequest.onsuccess = () => resolve(getRequest.result)
        getRequest.onerror = () => reject(new DexBeeError(
          DexBeeErrorCode.TRANSACTION_FAILED,
          `Failed to retrieve inserted record: ${getRequest.error?.message}`,
          getRequest.error || undefined,
        ))
      }
      request.onerror = () => reject(new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Failed to insert record: ${request.error?.message}`,
        request.error || undefined,
      ))
    })
  }

  async update(id: any, data: Partial<T>): Promise<T> {
    const tx = await this.getTransaction([this.name], 'readwrite')
    const store = tx.getStore(this.name)

    return new Promise((resolve, reject) => {
      // First, get the existing record
      const getRequest = store.get(id)
      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result
        if (!existingRecord) {
          reject(new DexBeeError(
            DexBeeErrorCode.TRANSACTION_FAILED,
            `Record with ID ${id} not found for update`,
          ))
          return
        }

        // Merge the existing record with the update data
        const updatedRecord = { ...existingRecord, ...data }

        // Update the record
        const putRequest = store.put(updatedRecord)
        putRequest.onsuccess = () => resolve(updatedRecord)
        putRequest.onerror = () => reject(new DexBeeError(
          DexBeeErrorCode.TRANSACTION_FAILED,
          `Failed to update record: ${putRequest.error?.message}`,
          putRequest.error || undefined,
        ))
      }
      getRequest.onerror = () => reject(new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Failed to find record for update: ${getRequest.error?.message}`,
        getRequest.error || undefined,
      ))
    })
  }

  async delete(id: any): Promise<boolean> {
    const tx = await this.getTransaction([this.name], 'readwrite')
    const store = tx.getStore(this.name)

    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Failed to delete record: ${request.error?.message}`,
        request.error || undefined,
      ))
    })
  }

  // Bulk operations
  async insertMany(records: Partial<T>[]): Promise<T[]> {
    const tx = await this.getTransaction([this.name], 'readwrite')
    const store = tx.getStore(this.name)
    const insertedRecords: T[] = []

    return new Promise((resolve, reject) => {
      let completed = 0
      let hasError = false

      if (records.length === 0) {
        resolve([])
        return
      }

      for (let record of records) {
        // Apply defaults and validate if available
        if (this.applyDefaults) {
          record = this.applyDefaults(this.name, record)
        }
        if (this.validateData) {
          this.validateData(this.name, record)
        }

        const request = store.add(record)

        request.onsuccess = () => {
          if (hasError)
            return

          // Get the inserted record with auto-generated fields
          const getRequest = store.get(request.result)
          getRequest.onsuccess = () => {
            if (hasError)
              return

            insertedRecords.push(getRequest.result)
            completed++

            if (completed === records.length) {
              resolve(insertedRecords)
            }
          }
          getRequest.onerror = () => {
            if (!hasError) {
              hasError = true
              reject(new DexBeeError(
                DexBeeErrorCode.TRANSACTION_FAILED,
                `Failed to retrieve inserted record: ${getRequest.error?.message}`,
                getRequest.error || undefined,
              ))
            }
          }
        }

        request.onerror = () => {
          if (!hasError) {
            hasError = true
            reject(new DexBeeError(
              DexBeeErrorCode.TRANSACTION_FAILED,
              `Failed to insert record: ${request.error?.message}`,
              request.error || undefined,
            ))
          }
        }
      }
    })
  }
}
