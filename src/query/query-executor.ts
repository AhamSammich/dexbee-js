import type { ITransactionWrapper } from '../core/interfaces.js'
import type {
  AggregationResult,
  GroupByQuery,
  GroupedAggregationResult,
  QueryOptions,
  QueryResult,
  RelationshipQuery,
  WhereCondition,
} from '../types/query.js'
import type { DatabaseSchema, RelationshipDefinition } from '../types/schema.js'
import type { IQueryExecutor } from './interfaces.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'

export class QueryExecutor implements IQueryExecutor {
  constructor(
    private getTransaction: (stores: string[], mode: 'readonly' | 'readwrite') => Promise<ITransactionWrapper>,
    private schema: DatabaseSchema,
  ) {}

  async execute<T>(tableName: string, options: QueryOptions<T>): Promise<QueryResult<T>> {
    const tx = await this.getTransaction([tableName], 'readonly')
    const store = tx.getStore(tableName)

    let results: T[] = []
    let count = 0

    try {
      // Handle different query scenarios
      if (options.where) {
        results = await this.executeWithConditions(store, options)
      }
      else {
        results = await this.executeFullScan(store, options)
      }

      count = results.length

      // Apply limit/offset after filtering (not ideal for performance, but correct)
      if (options.offset || options.limit) {
        const start = options.offset || 0
        const end = options.limit ? start + options.limit : undefined
        results = results.slice(start, end)
      }

      // Load relationships if requested
      if (options.include && options.include.length > 0) {
        results = await this.loadRelationships(tableName, results, options.include)
      }

      return { data: results, count }
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  private async executeWithConditions<T>(store: IDBObjectStore, options: QueryOptions<T>): Promise<T[]> {
    const condition = options.where!

    // Try to use indexes for better performance
    if (condition.type === 'comparison' && condition.field && this.canUseIndex(store, condition)) {
      return this.executeWithIndex(store, condition, options)
    }

    // Fall back to full scan with filtering
    return this.executeWithFiltering(store, condition, options)
  }

  private async executeFullScan<T>(store: IDBObjectStore, options: QueryOptions<T>): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: T[] = []
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          let record = cursor.value

          // Apply field selection if specified
          if (options.select && options.select.length > 0) {
            record = this.selectFields(record, options.select as string[])
          }

          results.push(record)
          cursor.continue()
        }
        else {
          // Apply sorting if specified
          if (options.orderBy && options.orderBy.length > 0) {
            this.sortResults(results, options.orderBy)
          }

          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  private async executeWithIndex<T>(
    store: IDBObjectStore,
    condition: WhereCondition<T>,
    options: QueryOptions<T>,
  ): Promise<T[]> {
    const fieldName = condition.field as string

    try {
      const index = store.index(fieldName)
      const range = this.createKeyRange(condition)

      return new Promise((resolve, reject) => {
        const results: T[] = []
        const request = range ? index.openCursor(range) : index.openCursor()

        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            let record = cursor.value

            // Apply field selection if specified
            if (options.select && options.select.length > 0) {
              record = this.selectFields(record, options.select as string[])
            }

            results.push(record)
            cursor.continue()
          }
          else {
            // Apply sorting if specified and different from index order
            if (options.orderBy && options.orderBy.length > 0) {
              this.sortResults(results, options.orderBy)
            }

            resolve(results)
          }
        }

        request.onerror = () => reject(request.error)
      })
    }
    catch {
      // Index doesn't exist, fall back to full scan
      return this.executeWithFiltering(store, condition, options)
    }
  }

  private async executeWithFiltering<T>(
    store: IDBObjectStore,
    condition: WhereCondition<T>,
    options: QueryOptions<T>,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: T[] = []
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const record = cursor.value

          // Apply condition filtering
          if (this.evaluateCondition(record, condition)) {
            let filteredRecord = record

            // Apply field selection if specified
            if (options.select && options.select.length > 0) {
              filteredRecord = this.selectFields(record, options.select as string[])
            }

            results.push(filteredRecord)
          }

          cursor.continue()
        }
        else {
          // Apply sorting if specified
          if (options.orderBy && options.orderBy.length > 0) {
            this.sortResults(results, options.orderBy)
          }

          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  private canUseIndex(store: IDBObjectStore, condition: WhereCondition): boolean {
    if (condition.type !== 'comparison' || !condition.field)
      return false

    const fieldName = condition.field as string
    try {
      store.index(fieldName)
      return ['eq', 'gt', 'gte', 'lt', 'lte', 'between'].includes(condition.operator)
    }
    catch {
      return false
    }
  }

  private createKeyRange(condition: WhereCondition): IDBKeyRange | null {
    const { operator, value, values } = condition

    switch (operator) {
      case 'eq': {
        return IDBKeyRange.only(value)
      }
      case 'gt': {
        return IDBKeyRange.lowerBound(value, true)
      }
      case 'gte': {
        return IDBKeyRange.lowerBound(value, false)
      }
      case 'lt': {
        return IDBKeyRange.upperBound(value, true)
      }
      case 'lte': {
        return IDBKeyRange.upperBound(value, false)
      }
      case 'between': {
        if (values && values.length === 2) {
          return IDBKeyRange.bound(values[0], values[1], false, false)
        }
        return null
      }
      default: {
        return null
      }
    }
  }

  private evaluateCondition(record: any, condition: WhereCondition): boolean {
    if (condition.type === 'logical') {
      return this.evaluateLogicalCondition(record, condition)
    }

    const fieldValue = record[condition.field as string]

    switch (condition.operator) {
      case 'eq': {
        return fieldValue === condition.value
      }
      case 'gt': {
        return fieldValue > condition.value
      }
      case 'gte': {
        return fieldValue >= condition.value
      }
      case 'lt': {
        return fieldValue < condition.value
      }
      case 'lte': {
        return fieldValue <= condition.value
      }
      case 'between': {
        if (condition.values && condition.values.length === 2) {
          return fieldValue >= condition.values[0] && fieldValue <= condition.values[1]
        }
        return false
      }
      case 'in': {
        return condition.values?.includes(fieldValue) ?? false
      }
      case 'notIn': {
        return !(condition.values?.includes(fieldValue) ?? true)
      }
      default: {
        return false
      }
    }
  }

  private evaluateLogicalCondition(record: any, condition: WhereCondition): boolean {
    if (!condition.conditions)
      return false

    switch (condition.operator) {
      case 'and': {
        return condition.conditions.every(c => this.evaluateCondition(record, c))
      }
      case 'or': {
        return condition.conditions.some(c => this.evaluateCondition(record, c))
      }
      case 'not': {
        return condition.conditions.length > 0 && !this.evaluateCondition(record, condition.conditions[0])
      }
      default: {
        return false
      }
    }
  }

  private selectFields(record: any, fields: string[]): any {
    const selected: any = {}
    for (const field of fields) {
      if (field in record) {
        selected[field] = record[field]
      }
    }
    return selected
  }

  private sortResults<T>(results: T[], orderBy: { field: keyof T, direction: 'asc' | 'desc' }[]): void {
    results.sort((a, b) => {
      for (const { field, direction } of orderBy) {
        const aVal = a[field]
        const bVal = b[field]

        let comparison = 0
        if (aVal < bVal)
          comparison = -1
        else if (aVal > bVal)
          comparison = 1

        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison
        }
      }
      return 0
    })
  }

  private async loadRelationships<T>(tableName: string, results: T[], includes: RelationshipQuery[]): Promise<T[]> {
    if (results.length === 0)
      return results

    const tableConfig = this.schema.tables[tableName]
    if (!tableConfig?.relationships)
      return results

    // Get all related table names for transaction
    const relatedTables = includes
      .map((inc) => {
        const relationship = tableConfig.relationships![inc.name]
        if (!relationship)
          return []

        const tables = [relationship.table]
        if (relationship.through) {
          tables.push(relationship.through)
        }
        return tables
      })
      .flat()
      .filter((table, index, arr) => arr.indexOf(table) === index) // unique tables

    const tx = await this.getTransaction([tableName, ...relatedTables], 'readonly')

    // Load each relationship
    for (const include of includes) {
      const relationship = tableConfig.relationships[include.name]
      if (!relationship) {
        console.warn(`Relationship '${include.name}' not found in table '${tableName}' schema`)
        continue
      }

      await this.loadRelationshipData(tx, tableName, relationship, include, results)
    }

    return results
  }

  private async loadRelationshipData<T>(
    tx: ITransactionWrapper,
    tableName: string,
    relationship: RelationshipDefinition,
    include: RelationshipQuery,
    results: T[],
  ): Promise<void> {
    switch (relationship.type) {
      case 'hasOne': {
        await this.loadHasOneRelationship(tx, tableName, relationship, include, results)
        break
      }
      case 'hasMany': {
        await this.loadHasManyRelationship(tx, tableName, relationship, include, results)
        break
      }
      case 'belongsTo': {
        await this.loadBelongsToRelationship(tx, tableName, relationship, include, results)
        break
      }
      case 'belongsToMany': {
        await this.loadBelongsToManyRelationship(tx, tableName, relationship, include, results)
        break
      }
    }
  }

  private async loadHasOneRelationship<T>(
    tx: ITransactionWrapper,
    tableName: string,
    relationship: RelationshipDefinition,
    include: RelationshipQuery,
    results: T[],
  ): Promise<void> {
    const relatedStore = tx.getStore(relationship.table)
    const localKey = relationship.localKey || 'id'
    const foreignKey = relationship.foreignKey || `${tableName}Id`

    for (const result of results) {
      const localValue = (result as any)[localKey]
      if (localValue == null)
        continue

      // Find related record by foreign key
      const relatedRecord = await this.findByField(relatedStore, foreignKey, localValue, include)
      ;(result as any)[include.name] = relatedRecord
    }
  }

  private async loadHasManyRelationship<T>(
    tx: ITransactionWrapper,
    tableName: string,
    relationship: RelationshipDefinition,
    include: RelationshipQuery,
    results: T[],
  ): Promise<void> {
    const relatedStore = tx.getStore(relationship.table)
    const localKey = relationship.localKey || 'id'
    const foreignKey = relationship.foreignKey || `${tableName}Id`

    for (const result of results) {
      const localValue = (result as any)[localKey]
      if (localValue == null) {
        ;(result as any)[include.name] = []
        continue
      }

      // Find all related records by foreign key
      const relatedRecords = await this.findAllByField(relatedStore, foreignKey, localValue, include)
      ;(result as any)[include.name] = relatedRecords
    }
  }

  private async loadBelongsToRelationship<T>(
    tx: ITransactionWrapper,
    tableName: string,
    relationship: RelationshipDefinition,
    include: RelationshipQuery,
    results: T[],
  ): Promise<void> {
    const relatedStore = tx.getStore(relationship.table)
    const localKey = relationship.localKey || `${relationship.table}Id`
    const foreignKey = relationship.foreignKey || 'id'

    for (const result of results) {
      const localValue = (result as any)[localKey]
      if (localValue == null)
        continue

      // Find related record by primary key
      const relatedRecord = await this.findByField(relatedStore, foreignKey, localValue, include)
      ;(result as any)[include.name] = relatedRecord
    }
  }

  private async loadBelongsToManyRelationship<T>(
    tx: ITransactionWrapper,
    tableName: string,
    relationship: RelationshipDefinition,
    include: RelationshipQuery,
    results: T[],
  ): Promise<void> {
    if (!relationship.through) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `belongsToMany relationship requires 'through' table specification`,
      )
    }

    const relatedStore = tx.getStore(relationship.table)
    const throughStore = tx.getStore(relationship.through)
    const localKey = relationship.localKey || 'id'
    const throughLocalKey = relationship.throughLocalKey || `${tableName}Id`
    const throughForeignKey = relationship.throughForeignKey || `${relationship.table}Id`
    const foreignKey = relationship.foreignKey || 'id'

    for (const result of results) {
      const localValue = (result as any)[localKey]
      if (localValue == null) {
        ;(result as any)[include.name] = []
        continue
      }

      // 1. Find pivot records in through table
      const pivotRecords = await this.findAllByField(throughStore, throughLocalKey, localValue)

      // 2. Extract foreign keys from pivot records
      const foreignKeys = pivotRecords.map(pivot => pivot[throughForeignKey]).filter(Boolean)

      // 3. Find related records by foreign keys
      const relatedRecords = []
      for (const foreignKeyValue of foreignKeys) {
        const relatedRecord = await this.findByField(relatedStore, foreignKey, foreignKeyValue, include)
        if (relatedRecord) {
          relatedRecords.push(relatedRecord)
        }
      }

      ;(result as any)[include.name] = relatedRecords
    }
  }

  private async findByField(
    store: IDBObjectStore,
    fieldName: string,
    value: any,
    include?: RelationshipQuery,
  ): Promise<any | null> {
    return new Promise((resolve, reject) => {
      // Try to use index if available
      try {
        const index = store.index(fieldName)
        const request = index.get(value)

        request.onsuccess = () => {
          let result = request.result
          if (result && include) {
            result = this.applyIncludeOptions(result, include)
          }
          resolve(result || null)
        }

        request.onerror = () => reject(request.error)
      }
      catch {
        // No index, use cursor scan
        this.findByFieldWithCursor(store, fieldName, value, include).then(resolve, reject)
      }
    })
  }

  private async findAllByField(
    store: IDBObjectStore,
    fieldName: string,
    value: any,
    include?: RelationshipQuery,
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = []

      // Try to use index if available
      try {
        const index = store.index(fieldName)
        const request = index.openCursor(IDBKeyRange.only(value))

        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            let result = cursor.value
            if (include) {
              result = this.applyIncludeOptions(result, include)
            }
            if (result !== null) {
              results.push(result)
            }
            cursor.continue()
          }
          else {
            if (include?.orderBy) {
              this.sortResults(results, include.orderBy)
            }
            if (include?.limit) {
              results.splice(include.limit)
            }
            resolve(results)
          }
        }

        request.onerror = () => reject(request.error)
      }
      catch {
        // No index, use cursor scan
        this.findAllByFieldWithCursor(store, fieldName, value, include).then(resolve, reject)
      }
    })
  }

  private async findByFieldWithCursor(
    store: IDBObjectStore,
    fieldName: string,
    value: any,
    include?: RelationshipQuery,
  ): Promise<any | null> {
    return new Promise((resolve, reject) => {
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const record = cursor.value
          if (record[fieldName] === value) {
            let result = record
            if (include) {
              result = this.applyIncludeOptions(result, include)
            }
            resolve(result)
            return
          }
          cursor.continue()
        }
        else {
          resolve(null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  private async findAllByFieldWithCursor(
    store: IDBObjectStore,
    fieldName: string,
    value: any,
    include?: RelationshipQuery,
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = []
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const record = cursor.value
          if (record[fieldName] === value) {
            let result = record
            if (include) {
              result = this.applyIncludeOptions(result, include)
            }
            if (result !== null) {
              results.push(result)
            }
          }
          cursor.continue()
        }
        else {
          if (include?.orderBy) {
            this.sortResults(results, include.orderBy)
          }
          if (include?.limit) {
            results.splice(include.limit)
          }
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  private applyIncludeOptions(record: any, include: RelationshipQuery): any {
    // Apply where conditions first - if record doesn't match, return null
    if (include.where && !this.evaluateCondition(record, include.where)) {
      return null // Record doesn't match where condition
    }

    let result = record

    // Apply field selection if specified (after filtering)
    if (include.select && include.select.length > 0) {
      result = this.selectFields(record, include.select)
    }

    return result
  }

  async aggregate<T>(
    tableName: string,
    options: QueryOptions<T>,
  ): Promise<AggregationResult | GroupedAggregationResult<T>> {
    const tx = await this.getTransaction([tableName], 'readonly')
    const store = tx.getStore(tableName)

    try {
      // First, get all records that match the where condition
      let records: any[] = []

      if (options.where) {
        records = await this.executeWithConditions(store, { where: options.where })
      }
      else {
        records = await this.executeFullScan(store, {})
      }

      if (!options.aggregation) {
        throw new DexBeeError(DexBeeErrorCode.TRANSACTION_FAILED, 'Aggregation function not specified')
      }

      const { function: aggregationFn, field } = options.aggregation

      // Check if we have groupBy
      if (options.groupBy && options.groupBy.fields.length > 0) {
        return this.executeGroupedAggregation(records, aggregationFn, field, options.groupBy)
      }
      else {
        return this.executeSimpleAggregation(records, aggregationFn, field)
      }
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.TRANSACTION_FAILED,
        `Aggregation execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  private executeSimpleAggregation(
    records: any[],
    aggregationFn: string,
    field?: string | number | symbol,
  ): AggregationResult {
    if (aggregationFn === 'count') {
      return {
        value: records.length,
        count: records.length,
      }
    }

    if (!field) {
      throw new DexBeeError(DexBeeErrorCode.TRANSACTION_FAILED, `Field is required for ${aggregationFn} aggregation`)
    }

    const values = records
      .map(record => record[field as string])
      .filter(value => value != null && typeof value === 'number')

    if (values.length === 0) {
      return {
        value: 0,
        count: 0,
      }
    }

    let result: number
    switch (aggregationFn) {
      case 'sum': {
        result = values.reduce((sum, value) => sum + value, 0)
        break
      }
      case 'avg': {
        result = values.reduce((sum, value) => sum + value, 0) / values.length
        break
      }
      case 'max': {
        result = Math.max(...values)
        break
      }
      case 'min': {
        result = Math.min(...values)
        break
      }
      default: {
        throw new DexBeeError(DexBeeErrorCode.TRANSACTION_FAILED, `Unknown aggregation function: ${aggregationFn}`)
      }
    }

    return {
      value: result,
      count: values.length,
    }
  }

  private executeGroupedAggregation<T>(
    records: any[],
    aggregationFn: string,
    field: string | number | symbol | undefined,
    groupBy: GroupByQuery<T>,
  ): GroupedAggregationResult<T> {
    // Group records by the specified fields
    const groups = new Map<string, any[]>()

    for (const record of records) {
      // Create a group key from the grouping fields
      const groupKey = groupBy.fields.map(f => record[f as string]).join('|') // Simple separator, could be improved

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(record)
    }

    const result: GroupedAggregationResult<T> = {
      groups: [],
      totalCount: records.length,
    }

    // Calculate aggregation for each group
    for (const [groupKey, groupRecords] of groups) {
      const keyValues = groupKey.split('|')
      const key: Partial<T> = {}

      // Reconstruct the group key object
      groupBy.fields.forEach((field, index) => {
        ;(key as any)[field] = keyValues[index]
      })

      // Apply having filter if specified
      if (groupBy.having) {
        // For having, we need to evaluate the condition on aggregated values
        // This is a simplified implementation - a full implementation would
        // need to handle having conditions properly
        const groupAggregation = this.executeSimpleAggregation(groupRecords, aggregationFn, field)

        // Create a temporary object with the aggregated value for having evaluation
        const havingContext = {
          ...key,
          _aggregated_value: groupAggregation.value,
          _count: groupAggregation.count,
        }

        if (!this.evaluateCondition(havingContext, groupBy.having)) {
          continue // Skip this group
        }
      }

      const groupAggregation = this.executeSimpleAggregation(groupRecords, aggregationFn, field)

      result.groups.push({
        key,
        value: groupAggregation.value,
        count: groupAggregation.count,
      })
    }

    return result
  }
}
