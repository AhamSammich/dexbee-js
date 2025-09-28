export type ComparisonOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'notIn'
export type LogicalOperator = 'and' | 'or' | 'not'
export type AggregationFunction = 'sum' | 'avg' | 'max' | 'min' | 'count'

export interface WhereCondition<T = any> {
  type: 'comparison' | 'logical'
  operator: ComparisonOperator | LogicalOperator
  field?: keyof T
  value?: any
  values?: any[]
  conditions?: WhereCondition<T>[]
}

export interface RelationshipQuery {
  name: string // Relationship name from schema
  select?: string[] // Fields to select from related table
  where?: WhereCondition<any> // Conditions for related records
  orderBy?: {
    field: string
    direction: 'asc' | 'desc'
  }[]
  limit?: number
}

export interface AggregationQuery<T = any> {
  function: AggregationFunction
  field?: keyof T // Optional for count()
}

export interface GroupByQuery<T = any> {
  fields: (keyof T)[]
  having?: WhereCondition<any> // Post-aggregation filtering
}

export interface QueryOptions<T = any> {
  select?: (keyof T)[]
  where?: WhereCondition<T>
  orderBy?: {
    field: keyof T
    direction: 'asc' | 'desc'
  }[]
  limit?: number
  offset?: number
  include?: RelationshipQuery[] // Relationships to include in results
  groupBy?: GroupByQuery<T> // Group by fields
  aggregation?: AggregationQuery<T> // Aggregation function
}

export interface QueryResult<T = any> {
  data: T[]
  count: number
}

export interface AggregationResult {
  value: number
  count: number // Number of records that contributed to the aggregation
}

export interface GroupedAggregationResult<T = any> {
  groups: Array<{
    key: Partial<T> // The grouping key(s)
    value: number // The aggregated value
    count: number // Number of records in this group
  }>
  totalCount: number
}

// Helper types for type-safe field selection
export type SelectedFields<T, K extends keyof T> = Pick<T, K>
export type AllFields<T> = T
