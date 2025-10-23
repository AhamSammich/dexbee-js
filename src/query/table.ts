import type { ITransactionWrapper } from '../core/interfaces.js'
import type { BlobMetadata } from '../types/schema.js'
import type { QueryBuilder } from './query-builder.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'
import { createQueryBuilder } from './query-builder.js'

/**
 * Represents a database table with type-safe operations and SQL-like query interface.
 * Provides CRUD operations, query building, aggregations, and blob storage capabilities.
 *
 * @template T The TypeScript type representing the table's record structure
 */
export class Table<T = any> {
  private queryBuilder: QueryBuilder<T>

  /**
   * Creates a new Table instance.
   *
   * @param name - The table name in the database
   * @param getTransaction - Function to create database transactions
   * @param schema - The database schema definition
   * @param applyDefaults - Optional function to apply default values to records
   * @param validateData - Optional function to validate record data
   */
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

  /**
   * Specifies which fields to select from the table.
   * Creates a new QueryBuilder with field projection.
   *
   * @template K The keys of T to select
   * @param fields - The field names to include in the result
   * @returns A QueryBuilder instance with the specified field selection
   *
   * @example
   * ```typescript
   * const userNames = await table.select('name', 'email').all()
   * ```
   */
  select<K extends keyof T>(...fields: K[]): QueryBuilder<Pick<T, K>> {
    return this.queryBuilder.select(...fields)
  }

  /**
   * Adds a WHERE condition to filter records.
   * Creates a new QueryBuilder with the specified condition.
   *
   * @param condition - The condition to filter records
   * @returns A QueryBuilder instance with the where condition
   *
   * @example
   * ```typescript
   * const adults = await table.where(gt('age', 18)).all()
   * ```
   */
  where(condition: import('../types/query.js').WhereCondition<T>): QueryBuilder<T> {
    return this.queryBuilder.where(condition)
  }

  /**
   * Adds ordering to the query results.
   * Creates a new QueryBuilder with the specified ordering.
   *
   * @param field - The field to order by
   * @param direction - Sort direction ('asc' or 'desc'), defaults to 'asc'
   * @returns A QueryBuilder instance with the ordering applied
   *
   * @example
   * ```typescript
   * const sortedUsers = await table.orderBy('name', 'desc').all()
   * ```
   */
  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    return this.queryBuilder.orderBy(field, direction)
  }

  /**
   * Limits the number of records returned.
   * Creates a new QueryBuilder with the specified limit.
   *
   * @param count - Maximum number of records to return
   * @returns A QueryBuilder instance with the limit applied
   *
   * @example
   * ```typescript
   * const first10 = await table.limit(10).all()
   * ```
   */
  limit(count: number): QueryBuilder<T> {
    return this.queryBuilder.limit(count)
  }

  /**
   * Skips the specified number of records.
   * Creates a new QueryBuilder with the specified offset.
   *
   * @param count - Number of records to skip
   * @returns A QueryBuilder instance with the offset applied
   *
   * @example
   * ```typescript
   * const page2 = await table.offset(20).limit(10).all()
   * ```
   */
  offset(count: number): QueryBuilder<T> {
    return this.queryBuilder.offset(count)
  }

  // Relationship methods

  /**
   * Includes related data in the query results (eager loading).
   * Creates a new QueryBuilder with the specified relationship included.
   *
   * @param relationshipName - Name of the relationship to include
   * @param options - Optional relationship query options
   * @returns A QueryBuilder instance with the relationship included
   *
   * @example
   * ```typescript
   * const usersWithPosts = await table.include('posts').all()
   * ```
   */
  include(relationshipName: string, options?: Partial<import('../types/query.js').RelationshipQuery>): QueryBuilder<T> {
    return this.queryBuilder.include(relationshipName, options)
  }

  /**
   * Alias for include() - includes related data in the query results.
   * Creates a new QueryBuilder with the specified relationship included.
   *
   * @param relationshipName - Name of the relationship to include
   * @param options - Optional relationship query options
   * @returns A QueryBuilder instance with the relationship included
   *
   * @example
   * ```typescript
   * const usersWithPosts = await table.with('posts').all()
   * ```
   */
  with(relationshipName: string, options?: Partial<import('../types/query.js').RelationshipQuery>): QueryBuilder<T> {
    return this.queryBuilder.with(relationshipName, options)
  }

  // Grouping methods

  /**
   * Groups query results by the specified fields.
   * Creates a new QueryBuilder with grouping applied.
   *
   * @param fields - Field names to group by
   * @returns A QueryBuilder instance with grouping applied
   *
   * @example
   * ```typescript
   * const grouped = await table.groupBy('category', 'status').count()
   * ```
   */
  groupBy(...fields: (keyof T)[]): QueryBuilder<T> {
    return this.queryBuilder.groupBy(...fields)
  }

  /**
   * Adds a HAVING condition for grouped results.
   * Creates a new QueryBuilder with the having condition.
   *
   * @param condition - Condition to filter grouped results
   * @returns A QueryBuilder instance with the having condition
   *
   * @example
   * ```typescript
   * const results = await table.groupBy('category').having(gt('count', 5)).all()
   * ```
   */
  having(condition: import('../types/query.js').WhereCondition<any>): QueryBuilder<T> {
    return this.queryBuilder.having(condition)
  }

  // Direct execution methods for simple queries

  /**
   * Executes the query and returns all matching records.
   *
   * @returns Promise resolving to array of all matching records
   *
   * @example
   * ```typescript
   * const allUsers = await table.all()
   * const adults = await table.where(gt('age', 18)).all()
   * ```
   */
  async all(): Promise<T[]> {
    return this.queryBuilder.all()
  }

  /**
   * Executes the query and returns the first matching record.
   *
   * @returns Promise resolving to the first record or null if none found
   *
   * @example
   * ```typescript
   * const user = await table.where(eq('email', 'user@example.com')).first()
   * const oldest = await table.orderBy('age', 'desc').first()
   * ```
   */
  async first(): Promise<T | null> {
    return this.queryBuilder.first()
  }

  /**
   * Counts the number of records matching the query.
   *
   * @returns Promise resolving to the count of matching records
   *
   * @example
   * ```typescript
   * const totalUsers = await table.count()
   * const adultCount = await table.where(gt('age', 18)).count()
   * ```
   */
  async count(): Promise<number> {
    return this.queryBuilder.count()
  }

  // Aggregation methods

  /**
   * Calculates the sum of a numeric field.
   *
   * @param field - The numeric field to sum
   * @returns Promise resolving to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const totalSales = await table.sum('amount')
   * const salesByCategory = await table.groupBy('category').sum('amount')
   * ```
   */
  async sum(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.sum(field)
  }

  /**
   * Calculates the average of a numeric field.
   *
   * @param field - The numeric field to average
   * @returns Promise resolving to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const avgAge = await table.avg('age')
   * const avgScoreByGrade = await table.groupBy('grade').avg('score')
   * ```
   */
  async avg(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.avg(field)
  }

  /**
   * Finds the maximum value of a field.
   *
   * @param field - The field to find maximum value for
   * @returns Promise resolving to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const maxAge = await table.max('age')
   * const maxScoreByGrade = await table.groupBy('grade').max('score')
   * ```
   */
  async max(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.max(field)
  }

  /**
   * Finds the minimum value of a field.
   *
   * @param field - The field to find minimum value for
   * @returns Promise resolving to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const minAge = await table.min('age')
   * const minScoreByGrade = await table.groupBy('grade').min('score')
   * ```
   */
  async min(field: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.min(field)
  }

  /**
   * Performs a general aggregation operation.
   *
   * @param fn - The aggregation function to apply
   * @param field - The field to aggregate (not needed for count)
   * @returns Promise resolving to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const result = await table.aggregate('sum', 'amount')
   * const counts = await table.groupBy('category').aggregate('count')
   * ```
   */
  async aggregate(fn: 'sum' | 'avg' | 'max' | 'min' | 'count', field?: keyof T): Promise<import('../types/query.js').AggregationResult | import('../types/query.js').GroupedAggregationResult<T>> {
    return this.queryBuilder.aggregate(fn, field)
  }

  // CRUD operations that work directly with transactions

  /**
   * Finds a single record by its primary key ID.
   *
   * @param id - The primary key value to search for
   * @returns Promise resolving to the record or null if not found
   *
   * @example
   * ```typescript
   * const user = await table.findById(123)
   * if (user) {
   *   console.log(`Found user: ${user.name}`)
   * }
   * ```
   */
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

  /**
   * Inserts a new record into the table.
   * Applies default values and validates data according to schema.
   *
   * @param data - The data to insert (required fields must be provided, id is optional for auto-increment)
   * @returns Promise resolving to the inserted record with auto-generated fields
   *
   * @example
   * ```typescript
   * const newUser = await table.insert({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   age: 30
   * })
   * console.log(`Inserted user with ID: ${newUser.id}`)
   * ```
   */
  async insert(data: import('../types/infer.js').InsertType<T>): Promise<T>
  async insert(data: any): Promise<T> {
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

  /**
   * Updates an existing record by merging new data with existing data.
   *
   * @param id - The primary key of the record to update
   * @param data - Partial data to merge with existing record
   * @returns Promise resolving to the updated record
   * @throws {DexBeeError} When record with given ID is not found
   *
   * @example
   * ```typescript
   * const updatedUser = await table.update(123, {
   *   age: 31,
   *   lastLogin: new Date()
   * })
   * console.log(`Updated user: ${updatedUser.name}`)
   * ```
   */
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

  /**
   * Deletes a record from the table by its primary key.
   *
   * @param id - The primary key of the record to delete
   * @returns Promise resolving to true if deletion was successful
   *
   * @example
   * ```typescript
   * const deleted = await table.delete(123)
   * if (deleted) {
   *   console.log('User deleted successfully')
   * }
   * ```
   */
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

  /**
   * Inserts multiple records in a single transaction for better performance.
   * Applies defaults and validates data for each record according to schema.
   *
   * @param records - Array of partial records to insert
   * @returns Promise resolving to array of inserted records with auto-generated fields
   *
   * @example
   * ```typescript
   * const users = await table.insertMany([
   *   { name: 'Alice', email: 'alice@example.com' },
   *   { name: 'Bob', email: 'bob@example.com' },
   *   { name: 'Charlie', email: 'charlie@example.com' }
   * ])
   * console.log(`Inserted ${users.length} users`)
   * ```
   */
  async insertMany(records: import('../types/infer.js').InsertType<T>[]): Promise<T[]> {
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

  // Blob-specific operations

  /**
   * Inserts a new record with blob data (Files, Blobs, or ArrayBuffers).
   * This is a convenience method that combines regular data with blob fields.
   *
   * @param data - The regular data fields to insert
   * @param blobs - Object mapping field names to blob data (File, Blob, or ArrayBuffer)
   * @returns Promise resolving to the inserted record with generated fields
   *
   * @example
   * ```typescript
   * const file = new File(['Hello world'], 'document.txt', { type: 'text/plain' })
   * const record = await table.insertWithBlob(
   *   { title: 'My Document', createdAt: new Date() },
   *   { content: file, thumbnail: someImageBlob }
   * )
   * ```
   */
  async insertWithBlob(data: Partial<T>, blobs: Partial<Record<keyof T, Blob | File | ArrayBuffer>>): Promise<T> {
    const fullData = { ...data, ...blobs }
    return this.insert(fullData as import('../types/infer.js').InsertType<T>)
  }

  /**
   * Updates a specific blob field in an existing record.
   *
   * @param id - The record ID to update
   * @param field - The blob field name to update
   * @param blob - The new blob data (File, Blob, or ArrayBuffer)
   * @returns Promise resolving to the updated record
   *
   * @example
   * ```typescript
   * const newFile = new File(['Updated content'], 'document.txt')
   * const updated = await table.updateBlob(1, 'content', newFile)
   * ```
   */
  async updateBlob(id: any, field: keyof T, blob: Blob | File | ArrayBuffer): Promise<T> {
    return this.update(id, { [field]: blob } as Partial<T>)
  }

  /**
   * Creates an object URL for a blob field that can be used in the browser.
   *
   * ⚠️ IMPORTANT: The returned URL must be revoked to prevent memory leaks!
   * Call URL.revokeObjectURL(url) when the URL is no longer needed.
   *
   * Example:
   * ```typescript
   * const url = await table.getBlobUrl(1, 'image')
   * // Use the URL (e.g., set as img src)
   * URL.revokeObjectURL(url) // Clean up to prevent memory leaks
   * ```
   *
   * @param id - The record ID
   * @param field - The blob field name
   * @returns Object URL for the blob
   */
  async getBlobUrl(id: any, field: keyof T): Promise<string> {
    const record = await this.findById(id)
    if (!record) {
      throw new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Record with ID ${id} not found`,
      )
    }

    const blob = record[field]
    if (!(blob instanceof Blob)) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Field '${String(field)}' is not a Blob or File`,
      )
    }

    return URL.createObjectURL(blob)
  }

  /**
   * Retrieves metadata about a blob field without loading the full blob data.
   * This is useful for displaying file information like size, type, and name.
   *
   * @param id - The record ID
   * @param field - The blob field name
   * @returns Promise resolving to blob metadata object
   *
   * @example
   * ```typescript
   * const metadata = await table.getBlobMetadata(1, 'attachment')
   * console.log(`File: ${metadata.name}, Size: ${metadata.size} bytes, Type: ${metadata.type}`)
   *
   * // For ArrayBuffers:
   * // { size: 1024, type: 'application/octet-stream' }
   *
   * // For Files:
   * // { size: 2048, type: 'text/plain', name: 'document.txt', lastModified: 1633024800000 }
   * ```
   */
  async getBlobMetadata(id: any, field: keyof T): Promise<BlobMetadata> {
    const record = await this.findById(id)
    if (!record) {
      throw new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Record with ID ${id} not found`,
      )
    }

    const value = record[field]

    // Handle ArrayBuffer
    if (value instanceof ArrayBuffer) {
      return {
        size: value.byteLength,
        type: 'application/octet-stream',
      }
    }

    // Handle Blob and File
    if (value instanceof Blob) {
      const metadata: BlobMetadata = {
        size: value.size,
        type: value.type,
      }

      if (value instanceof File) {
        metadata.name = value.name
        metadata.lastModified = value.lastModified
      }

      return metadata
    }

    throw new DexBeeError(
      DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
      `Field '${String(field)}' is not a Blob, File, or ArrayBuffer`,
    )
  }

  /**
   * Inserts multiple records that contain blob data in a single operation.
   * This is the batch version of insertWithBlob for better performance when inserting many records.
   *
   * @param records - Array of objects, each containing 'data' and 'blobs' properties
   * @returns Promise resolving to array of inserted records with generated fields
   *
   * @example
   * ```typescript
   * const file1 = new File(['Document 1'], 'doc1.txt')
   * const file2 = new File(['Document 2'], 'doc2.txt')
   *
   * const inserted = await table.insertManyWithBlobs([
   *   {
   *     data: { title: 'First Document', createdAt: new Date() },
   *     blobs: { content: file1 }
   *   },
   *   {
   *     data: { title: 'Second Document', createdAt: new Date() },
   *     blobs: { content: file2 }
   *   }
   * ])
   * ```
   */
  async insertManyWithBlobs(records: Array<{ data: Partial<T>, blobs: Partial<Record<keyof T, Blob | File | ArrayBuffer>> }>): Promise<T[]> {
    const fullRecords = records.map(({ data, blobs }) => ({ ...data, ...blobs }))
    return this.insertMany(fullRecords as import('../types/infer.js').InsertType<T>[])
  }
}
