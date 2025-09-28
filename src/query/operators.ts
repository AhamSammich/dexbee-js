import type { WhereCondition } from '../types/query.js'

// Comparison operators
export function eq<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'eq',
    field,
    value,
  }
}

export function gt<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'gt',
    field,
    value,
  }
}

export function gte<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'gte',
    field,
    value,
  }
}

export function lt<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'lt',
    field,
    value,
  }
}

export function lte<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'lte',
    field,
    value,
  }
}

export function between<T>(field: keyof T, min: any, max: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'between',
    field,
    values: [min, max],
  }
}

export function in_<T>(field: keyof T, values: any[]): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'in',
    field,
    values,
  }
}

export function notIn<T>(field: keyof T, values: any[]): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'notIn',
    field,
    values,
  }
}

// Logical operators
export function and<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return {
    type: 'logical',
    operator: 'and',
    conditions,
  }
}

export function or<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return {
    type: 'logical',
    operator: 'or',
    conditions,
  }
}

export function not<T>(condition: WhereCondition<T>): WhereCondition<T> {
  return {
    type: 'logical',
    operator: 'not',
    conditions: [condition],
  }
}
