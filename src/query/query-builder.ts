import type { ITransactionWrapper } from '../core/interfaces.js'
import type { AggregationResult, GroupedAggregationResult, QueryOptions, RelationshipQuery, WhereCondition } from '../types/query.js'
import type { IQueryBuilder } from './interfaces.js'
import { QueryExecutor } from './query-executor.js'

/**
 * A fluent query builder for constructing and executing database queries.
 * Provides a chainable API for building complex queries with conditions, sorting,
 * aggregations, and relationships.
 *
 * @template T The type representing the table/entity being queried
 *
 * @example
 * ```typescript
 * const users = await queryBuilder
 *   .select('id', 'name', 'email')
 *   .where(eq('status', 'active'))
 *   .orderBy('name', 'asc')
 *   .limit(10)
 *   .all()
 * ```
 */
export class QueryBuilder<T = any> implements IQueryBuilder<T> {
  private options: QueryOptions<T> = {}

  /**
   * Creates a new QueryBuilder instance.
   *
   * @param tableName - The name of the table/store to query
   * @param executor - The QueryExecutor instance for executing queries
   */
  constructor(
    private tableName: string,
    private executor: QueryExecutor,
  ) {}

  /**
   * Specifies which fields to select from the query result.
   *
   * @template K The keys of T representing the fields to select
   * @param fields - The field names to include in the result
   * @returns A new QueryBuilder instance with the specified fields selected
   *
   * @example
   * ```typescript
   * const result = await queryBuilder.select('id', 'name').all()
   * // result will only contain 'id' and 'name' fields
   * ```
   */
  select<K extends keyof T>(...fields: K[]): QueryBuilder<Pick<T, K>> {
    const newBuilder = this.clone<Pick<T, K>>()
    newBuilder.options.select = fields as (keyof Pick<T, K>)[]
    return newBuilder
  }

  /**
   * Adds a WHERE condition to filter the query results.
   * Multiple where conditions are combined using AND logic.
   *
   * @param condition - The condition to apply for filtering
   * @returns A new QueryBuilder instance with the condition applied
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .where(eq('status', 'active'))
   *   .where(gt('age', 18))
   *   .all()
   * ```
   */
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

  /**
   * Adds an ORDER BY clause to sort the query results.
   * Multiple orderBy calls can be chained to sort by multiple fields.
   *
   * @param field - The field to sort by
   * @param direction - The sort direction ('asc' or 'desc'), defaults to 'asc'
   * @returns A new QueryBuilder instance with the ordering applied
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .orderBy('name', 'asc')
   *   .orderBy('createdAt', 'desc')
   *   .all()
   * ```
   */
  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.orderBy) {
      newBuilder.options.orderBy = []
    }

    newBuilder.options.orderBy.push({ field, direction })
    return newBuilder
  }

  /**
   * Limits the number of results returned by the query.
   *
   * @param count - The maximum number of results to return
   * @returns A new QueryBuilder instance with the limit applied
   *
   * @example
   * ```typescript
   * const result = await queryBuilder.limit(10).all()
   * // Returns at most 10 records
   * ```
   */
  limit(count: number): QueryBuilder<T> {
    const newBuilder = this.clone()
    newBuilder.options.limit = count
    return newBuilder
  }

  /**
   * Skips a specified number of results before returning data.
   * Useful for pagination when combined with limit().
   *
   * @param count - The number of results to skip
   * @returns A new QueryBuilder instance with the offset applied
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .offset(20)
   *   .limit(10)
   *   .all()
   * // Returns records 21-30
   * ```
   */
  offset(count: number): QueryBuilder<T> {
    const newBuilder = this.clone()
    newBuilder.options.offset = count
    return newBuilder
  }

  /**
   * Includes related data in the query results by specifying relationships to load.
   *
   * @param relationshipName - The name of the relationship to include
   * @param options - Optional configuration for the relationship query
   * @returns A new QueryBuilder instance with the relationship included
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .include('posts', { limit: 5 })
   *   .include('profile')
   *   .all()
   * ```
   */
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

  /**
   * Alias for include() method. Includes related data in the query results.
   * Provides more natural ORM-style syntax.
   *
   * @param relationshipName - The name of the relationship to include
   * @param options - Optional configuration for the relationship query
   * @returns A new QueryBuilder instance with the relationship included
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .with('posts')
   *   .with('profile')
   *   .all()
   * ```
   */
  with(relationshipName: string, options?: Partial<RelationshipQuery>): QueryBuilder<T> {
    // 'with' is an alias for 'include' for more natural ORM syntax
    return this.include(relationshipName, options)
  }

  /**
   * Groups the query results by one or more fields.
   * Used with aggregation functions to perform grouped calculations.
   *
   * @param fields - The field names to group by
   * @returns A new QueryBuilder instance with grouping applied
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .groupBy('category', 'status')
   *   .count()
   * ```
   */
  groupBy(...fields: (keyof T)[]): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.groupBy) {
      newBuilder.options.groupBy = { fields: [] }
    }

    newBuilder.options.groupBy.fields = fields
    return newBuilder
  }

  /**
   * Adds a HAVING clause to filter grouped results.
   * Can only be used after groupBy() has been called.
   *
   * @param condition - The condition to apply to grouped results
   * @returns A new QueryBuilder instance with the having condition applied
   * @throws {Error} If called without groupBy()
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .groupBy('category')
   *   .having(gt('count', 10))
   *   .count()
   * ```
   */
  having(condition: WhereCondition<any>): QueryBuilder<T> {
    const newBuilder = this.clone()

    if (!newBuilder.options.groupBy) {
      throw new Error('having() can only be used after groupBy()')
    }

    newBuilder.options.groupBy.having = condition
    return newBuilder
  }

  /**
   * Executes the query and returns all matching results as an array.
   *
   * @returns A promise that resolves to an array of all matching records
   *
   * @example
   * ```typescript
   * const users = await queryBuilder
   *   .where(eq('status', 'active'))
   *   .all()
   * console.log(users) // Array of user objects
   * ```
   */
  async all(): Promise<T[]> {
    const result = await this.executor.execute<T>(this.tableName, this.options)
    return result.data
  }

  /**
   * Executes the query and returns the first matching result, or null if no results.
   * Automatically applies a limit of 1 to optimize the query.
   *
   * @returns A promise that resolves to the first matching record or null
   *
   * @example
   * ```typescript
   * const user = await queryBuilder
   *   .where(eq('id', 123))
   *   .first()
   * console.log(user) // Single user object or null
   * ```
   */
  async first(): Promise<T | null> {
    const limitedOptions = { ...this.options, limit: 1 }
    const result = await this.executor.execute<T>(this.tableName, limitedOptions)
    return result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Executes the query and returns the count of matching results.
   * For grouped queries, returns the total count across all groups.
   *
   * @returns A promise that resolves to the count of matching records
   *
   * @example
   * ```typescript
   * const activeUserCount = await queryBuilder
   *   .where(eq('status', 'active'))
   *   .count()
   * console.log(activeUserCount) // Number of active users
   * ```
   */
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

  /**
   * Calculates the sum of values in a specified field.
   *
   * @param field - The field to sum
   * @returns A promise that resolves to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const totalAmount = await queryBuilder
   *   .where(eq('status', 'completed'))
   *   .sum('amount')
   * ```
   */
  async sum(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('sum', field)
  }

  /**
   * Calculates the average of values in a specified field.
   *
   * @param field - The field to average
   * @returns A promise that resolves to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const avgScore = await queryBuilder
   *   .where(eq('subject', 'math'))
   *   .avg('score')
   * ```
   */
  async avg(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('avg', field)
  }

  /**
   * Finds the maximum value in a specified field.
   *
   * @param field - The field to find the maximum value for
   * @returns A promise that resolves to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const maxAge = await queryBuilder
   *   .where(eq('department', 'engineering'))
   *   .max('age')
   * ```
   */
  async max(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('max', field)
  }

  /**
   * Finds the minimum value in a specified field.
   *
   * @param field - The field to find the minimum value for
   * @returns A promise that resolves to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const minSalary = await queryBuilder
   *   .where(eq('department', 'engineering'))
   *   .min('salary')
   * ```
   */
  async min(field: keyof T): Promise<AggregationResult | GroupedAggregationResult<T>> {
    return this.aggregate('min', field)
  }

  /**
   * Performs a custom aggregation function on the query results.
   * This is the underlying method used by sum, avg, max, min, and count.
   *
   * @param fn - The aggregation function to apply
   * @param field - The field to aggregate (not required for count)
   * @returns A promise that resolves to aggregation result (simple or grouped)
   *
   * @example
   * ```typescript
   * const result = await queryBuilder
   *   .groupBy('category')
   *   .aggregate('sum', 'amount')
   * ```
   */
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

  /**
   * Creates a deep copy of the current QueryBuilder instance.
   * This ensures that chaining operations don't mutate the original builder.
   *
   * @template U The type for the new QueryBuilder (defaults to T)
   * @returns A new QueryBuilder instance with copied options
   * @private
   */
  private clone<U = T>(): QueryBuilder<U> {
    const newBuilder = new QueryBuilder<U>(this.tableName, this.executor)
    newBuilder.options = JSON.parse(JSON.stringify(this.options))
    return newBuilder
  }
}

/**
 * Factory function to create a QueryBuilder instance with proper typing.
 * This is the recommended way to create QueryBuilder instances.
 *
 * @template T The type representing the table/entity being queried
 * @param tableName - The name of the table/store to query
 * @param getTransaction - Function to get database transactions
 * @param schema - The database schema configuration
 * @returns A new QueryBuilder instance configured for the specified table
 *
 * @example
 * ```typescript
 * interface User {
 *   id: number
 *   name: string
 *   email: string
 * }
 *
 * const userQuery = createQueryBuilder<User>('users', getTransaction, schema)
 * const users = await userQuery.where(eq('status', 'active')).all()
 * ```
 */
export function createQueryBuilder<T>(
  tableName: string,
  getTransaction: (stores: string[], mode: 'readonly' | 'readwrite') => Promise<ITransactionWrapper>,
  schema: import('../types/schema.js').DatabaseSchema,
): QueryBuilder<T> {
  const executor = new QueryExecutor(getTransaction, schema)
  return new QueryBuilder<T>(tableName, executor)
}
