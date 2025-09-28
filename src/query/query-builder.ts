import type { ITransactionWrapper } from '../core/interfaces.js'
import type { AggregationResult, GroupedAggregationResult, QueryOptions, RelationshipQuery, WhereCondition } from '../types/query.js'
import type { IQueryBuilder } from './interfaces.js'
import { QueryExecutor } from './query-executor.js'

export class QueryBuilder<T = any> implements IQueryBuilder<T> {
  private options: QueryOptions<T> = {}

  constructor(
    private tableName: string,
    private executor: QueryExecutor,
  ) {}

  select<K extends keyof T>(...fields: K[]): QueryBuilder<Pick<T, K>> {
    const newBuilder = this.clone<Pick<T, K>>()
    newBuilder.options.select = fields as (keyof Pick<T, K>)[]
    return newBuilder
  }

  where(condition: WhereCondition<T>): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (this.options.where) {
      // Combine with existing condition using AND
      newBuilder.options.where = {
        type: 'logical',
        operator: 'and',
        conditions: [this.options.where, condition],
      }
    }
    else {
      newBuilder.options.where = condition
    }

    return newBuilder
  }

  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.orderBy) {
      newBuilder.options.orderBy = []
    }

    newBuilder.options.orderBy.push({ field, direction })
    return newBuilder
  }

  limit(count: number): QueryBuilder<T> {
    const newBuilder = this.clone()
    newBuilder.options.limit = count
    return newBuilder
  }

  offset(count: number): QueryBuilder<T> {
    const newBuilder = this.clone()
    newBuilder.options.offset = count
    return newBuilder
  }

  include(relationshipName: string, options?: Partial<RelationshipQuery>): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.include) {
      newBuilder.options.include = []
    }

    const relationshipQuery: RelationshipQuery = {
      name: relationshipName,
      ...options,
    }

    newBuilder.options.include.push(relationshipQuery)
    return newBuilder
  }

  with(relationshipName: string, options?: Partial<RelationshipQuery>): QueryBuilder<T> {
    // 'with' is an alias for 'include' for more natural ORM syntax
    return this.include(relationshipName, options)
  }

  groupBy(...fields: (keyof T)[]): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.groupBy) {
      newBuilder.options.groupBy = { fields: [] }
    }

    newBuilder.options.groupBy.fields = fields
    return newBuilder
  }

  having(condition: WhereCondition<any>): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.groupBy) {
      throw new Error('having() can only be used after groupBy()')
    }

    newBuilder.options.groupBy.having = condition
    return newBuilder
  }

  async all(): Promise<T[]> {
    const result = await this.executor.execute<T>(this.tableName, this.options)
    return result.data
  }

  async first(): Promise<T | null> {
    const limitedOptions = { ...this.options, limit: 1 }
    const result = await this.executor.execute<T>(this.tableName, limitedOptions)
    return result.data.length > 0 ? result.data[0] : null
  }

  async count(): Promise<number> {
    // Check if we have groupBy - if so, use aggregation method
    if (this.options.groupBy) {
      const result = await this.aggregate('count')
      if ('groups' in result) {
        return result.totalCount
      }
      return result.count
    }

    // For simple count queries, we don't need to return the actual data
    const countOptions = {
      ...this.options,
      select: undefined, // Don't select fields for count
      limit: undefined, // Don't limit for count
      offset: undefined, // Don't offset for count
    }
    const result = await this.executor.execute<T>(this.tableName, countOptions)
    return result.count
  }

  async sum(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('sum', field)
  }

  async avg(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('avg', field)
  }

  async max(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('max', field)
  }

  async min(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('min', field)
  }

  async aggregate(fn: 'sum' | 'avg' | 'max' | 'min' | 'count', field?: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    const aggregationOptions: QueryOptions<T> = {
      ...this.options,
      aggregation: {
        function: fn,
        field,
      },
    }

    return this.executor.aggregate<T>(this.tableName, aggregationOptions)
  }

  private clone<U = T>(): QueryBuilder<U> {
    const newBuilder = new QueryBuilder<U>(this.tableName, this.executor)
    newBuilder.options = JSON.parse(JSON.stringify(this.options))
    return newBuilder
  }
}

// Factory function to create a QueryBuilder with proper typing
export function createQueryBuilder<T>(
  tableName: string,
  getTransaction: (stores: string[], mode: 'readonly' | 'readwrite') => Promise<ITransactionWrapper>,
  schema: import('../types/schema.js').DatabaseSchema,
): QueryBuilder<T> {
  const executor = new QueryExecutor(getTransaction, schema)
  return new QueryBuilder<T>(tableName, executor)
}
