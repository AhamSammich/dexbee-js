import type { WhereCondition } from '../types/query.js'

// Comparison operators

/**
 * Creates an equality condition for filtering query results.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param value - The value to compare against
 * @returns A WhereCondition for equality comparison
 *
 * @example
 * ```typescript
 * const condition = eq('status', 'active')
 * const users = await queryBuilder.where(condition).all()
 * ```
 */
export function eq<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'eq',
    field,
    value,
  }
}

/**
 * Creates a greater-than condition for filtering query results.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param value - The value to compare against
 * @returns A WhereCondition for greater-than comparison
 *
 * @example
 * ```typescript
 * const condition = gt('age', 18)
 * const adults = await queryBuilder.where(condition).all()
 * ```
 */
export function gt<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'gt',
    field,
    value,
  }
}

/**
 * Creates a greater-than-or-equal condition for filtering query results.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param value - The value to compare against
 * @returns A WhereCondition for greater-than-or-equal comparison
 *
 * @example
 * ```typescript
 * const condition = gte('score', 70)
 * const passingGrades = await queryBuilder.where(condition).all()
 * ```
 */
export function gte<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'gte',
    field,
    value,
  }
}

/**
 * Creates a less-than condition for filtering query results.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param value - The value to compare against
 * @returns A WhereCondition for less-than comparison
 *
 * @example
 * ```typescript
 * const condition = lt('price', 100)
 * const affordableItems = await queryBuilder.where(condition).all()
 * ```
 */
export function lt<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'lt',
    field,
    value,
  }
}

/**
 * Creates a less-than-or-equal condition for filtering query results.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param value - The value to compare against
 * @returns A WhereCondition for less-than-or-equal comparison
 *
 * @example
 * ```typescript
 * const condition = lte('quantity', 10)
 * const lowStockItems = await queryBuilder.where(condition).all()
 * ```
 */
export function lte<T>(field: keyof T, value: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'lte',
    field,
    value,
  }
}

/**
 * Creates a BETWEEN condition for filtering query results within a range.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param min - The minimum value (inclusive)
 * @param max - The maximum value (inclusive)
 * @returns A WhereCondition for range comparison
 *
 * @example
 * ```typescript
 * const condition = between('age', 18, 65)
 * const workingAge = await queryBuilder.where(condition).all()
 * ```
 */
export function between<T>(field: keyof T, min: any, max: any): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'between',
    field,
    values: [min, max],
  }
}

/**
 * Creates an IN condition for filtering query results that match any of the provided values.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param values - Array of values to match against
 * @returns A WhereCondition for IN comparison
 *
 * @example
 * ```typescript
 * const condition = inArray('status', ['active', 'pending', 'verified'])
 * const validUsers = await queryBuilder.where(condition).all()
 * ```
 */
export function inArray<T>(field: keyof T, values: any[]): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'in',
    field,
    values,
  }
}

/**
 * @deprecated Use inArray instead. This alias will be removed in a future version.
 *
 * Creates an IN condition for filtering query results that match any of the provided values.
 * This function is deprecated to avoid conflicts with JavaScript's 'in' operator.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param values - Array of values to match against
 * @returns A WhereCondition for IN comparison
 */
export function in_<T>(field: keyof T, values: any[]): WhereCondition<T> {
  return inArray(field, values)
}

/**
 * @deprecated Use not(inArray(...)) instead. This function will be removed in a future version.
 *
 * Creates a NOT IN condition for filtering query results that do not match any of the provided values.
 * This function is redundant since the same result can be achieved with `not(inArray(field, values))`
 * which is more composable and consistent with the logical operator design.
 *
 * @template T The type representing the table/entity being queried
 * @param field - The field name to compare
 * @param values - Array of values to exclude
 * @returns A WhereCondition for NOT IN comparison
 *
 * @example
 * ```typescript
 * // Deprecated approach:
 * const condition = notIn('status', ['deleted', 'banned'])
 *
 * // Preferred approach (more composable):
 * const condition = not(inArray('status', ['deleted', 'banned']))
 * const activeUsers = await queryBuilder.where(condition).all()
 * ```
 */
export function notIn<T>(field: keyof T, values: any[]): WhereCondition<T> {
  return {
    type: 'comparison',
    operator: 'notIn',
    field,
    values,
  }
}

// Logical operators

/**
 * Creates an AND condition that combines multiple conditions.
 * All provided conditions must be true for a record to match.
 *
 * @template T The type representing the table/entity being queried
 * @param conditions - Variable number of conditions to combine with AND logic
 * @returns A WhereCondition combining all conditions with AND logic
 *
 * @example
 * ```typescript
 * const condition = and(
 *   eq('status', 'active'),
 *   gt('age', 18),
 *   lt('score', 100)
 * )
 * const users = await queryBuilder.where(condition).all()
 * ```
 */
export function and<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return {
    type: 'logical',
    operator: 'and',
    conditions,
  }
}

/**
 * Creates an OR condition that combines multiple conditions.
 * At least one of the provided conditions must be true for a record to match.
 *
 * @template T The type representing the table/entity being queried
 * @param conditions - Variable number of conditions to combine with OR logic
 * @returns A WhereCondition combining all conditions with OR logic
 *
 * @example
 * ```typescript
 * const condition = or(
 *   eq('priority', 'high'),
 *   eq('priority', 'urgent')
 * )
 * const importantTasks = await queryBuilder.where(condition).all()
 * ```
 */
export function or<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return {
    type: 'logical',
    operator: 'or',
    conditions,
  }
}

/**
 * Creates a NOT condition that negates another condition.
 * Records that do NOT match the provided condition will be returned.
 *
 * @template T The type representing the table/entity being queried
 * @param condition - The condition to negate
 * @returns A WhereCondition that negates the provided condition
 *
 * @example
 * ```typescript
 * const condition = not(eq('status', 'deleted'))
 * const activeUsers = await queryBuilder.where(condition).all()
 * ```
 */
export function not<T>(condition: WhereCondition<T>): WhereCondition<T> {
  return {
    type: 'logical',
    operator: 'not',
    conditions: [condition],
  }
}
