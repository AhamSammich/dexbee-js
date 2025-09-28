import type { AggregationResult, GroupedAggregationResult, QueryOptions, QueryResult, RelationshipQuery, WhereCondition } from '../types/query.js'

export interface IQueryBuilder<T = any> {
  select: <K extends keyof T>(...fields: K[]) => IQueryBuilder<Pick<T, K>>
  where: (condition: WhereCondition<T>) => IQueryBuilder<T>
  orderBy: (field: keyof T, direction?: 'asc' | 'desc') => IQueryBuilder<T>
  limit: (count: number) => IQueryBuilder<T>
  offset: (count: number) => IQueryBuilder<T>

  // Relationship methods
  include: (relationshipName: string, options?: Partial<RelationshipQuery>) => IQueryBuilder<T>
  with: (relationshipName: string, options?: Partial<RelationshipQuery>) => IQueryBuilder<T>

  // Grouping methods
  groupBy: (...fields: (keyof T)[]) => IQueryBuilder<T>
  having: (condition: WhereCondition<any>) => IQueryBuilder<T>

  // Execution methods
  all: () => Promise<T[]>
  first: () => Promise<T | null>
  count: () => Promise<number>

  // Aggregation methods
  sum: (field: keyof T) => Promise<AggregationResult | GroupedAggregationResult<T>>
  avg: (field: keyof T) => Promise<AggregationResult | GroupedAggregationResult<T>>
  max: (field: keyof T) => Promise<AggregationResult | GroupedAggregationResult<T>>
  min: (field: keyof T) => Promise<AggregationResult | GroupedAggregationResult<T>>
  aggregate: (fn: 'sum' | 'avg' | 'max' | 'min' | 'count', field?: keyof T) => Promise<AggregationResult | GroupedAggregationResult<T>>
}

export interface IQueryExecutor {
  execute: <T>(tableName: string, options: QueryOptions<T>) => Promise<QueryResult<T>>
  aggregate: <T>(tableName: string, options: QueryOptions<T>) => Promise<AggregationResult | GroupedAggregationResult<T>>
}

export interface IConditionBuilder<T = any> {
  eq: (field: keyof T, value: any) => WhereCondition<T>
  gt: (field: keyof T, value: any) => WhereCondition<T>
  gte: (field: keyof T, value: any) => WhereCondition<T>
  lt: (field: keyof T, value: any) => WhereCondition<T>
  lte: (field: keyof T, value: any) => WhereCondition<T>
  between: (field: keyof T, min: any, max: any) => WhereCondition<T>
  in: (field: keyof T, values: any[]) => WhereCondition<T>
  notIn: (field: keyof T, values: any[]) => WhereCondition<T>
  and: (...conditions: WhereCondition<T>[]) => WhereCondition<T>
  or: (...conditions: WhereCondition<T>[]) => WhereCondition<T>
  not: (condition: WhereCondition<T>) => WhereCondition<T>
}
