import type { AggregationResult, GroupedAggregationResult, QueryOptions, QueryResult, RelationshipQuery, WhereCondition } from '../types/query.js'

export interface IQueryBuilder<TBase = any, TSelected = TBase> {
  select: <K extends keyof TBase>(...fields: K[]) => IQueryBuilder<TBase, Pick<TBase, K>>
  where: (condition: WhereCondition<TBase>) => IQueryBuilder<TBase, TSelected>
  orderBy: (field: keyof TBase, direction?: 'asc' | 'desc') => IQueryBuilder<TBase, TSelected>
  limit: (count: number) => IQueryBuilder<TBase, TSelected>
  offset: (count: number) => IQueryBuilder<TBase, TSelected>

  // Relationship methods
  include: (relationshipName: string, options?: Partial<RelationshipQuery>) => IQueryBuilder<TBase, TSelected>
  with: (relationshipName: string, options?: Partial<RelationshipQuery>) => IQueryBuilder<TBase, TSelected>

  // Grouping methods
  groupBy: (...fields: (keyof TBase)[]) => IQueryBuilder<TBase, TSelected>
  having: (condition: WhereCondition<any>) => IQueryBuilder<TBase, TSelected>

  // Execution methods
  all: () => Promise<TSelected[]>
  first: () => Promise<TSelected | null>
  count: () => Promise<number>

  // Aggregation methods
  sum: (field: keyof TBase) => Promise<AggregationResult | GroupedAggregationResult<TBase>>
  avg: (field: keyof TBase) => Promise<AggregationResult | GroupedAggregationResult<TBase>>
  max: (field: keyof TBase) => Promise<AggregationResult | GroupedAggregationResult<TBase>>
  min: (field: keyof TBase) => Promise<AggregationResult | GroupedAggregationResult<TBase>>
  aggregate: (fn: 'sum' | 'avg' | 'max' | 'min' | 'count', field?: keyof TBase) => Promise<AggregationResult | GroupedAggregationResult<TBase>>
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
