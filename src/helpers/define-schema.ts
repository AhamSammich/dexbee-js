/**
 * Schema definition helper that provides type inference without requiring `as const`.
 *
 * This helper function enables full type safety and inference by constraining the
 * schema definition at the function level, eliminating the need for `as const`.
 *
 * @module
 */

import type { DatabaseSchema } from '../types/schema.js'

/**
 * Defines a database schema with full type inference.
 *
 * This is the recommended way to define schemas as it:
 * - Eliminates the need for `as const`
 * - Provides better type inference
 * - Gives cleaner error messages
 * - Enables autocomplete for schema properties
 *
 * @template T - The schema type, automatically inferred
 * @param schema - The database schema definition
 * @returns The same schema, but with narrowed literal types for inference
 *
 * @example
 * ```typescript
 * import { defineSchema, DexBee } from 'dexbee'
 *
 * const schema = defineSchema({
 *   version: 1,
 *   tables: {
 *     users: {
 *       schema: {
 *         id: { type: 'number', required: true },
 *         name: { type: 'string', required: true },
 *         email: { type: 'string', required: true },
 *         age: { type: 'number' }, // optional
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true,
 *     },
 *   },
 * })
 *
 * // No type parameter needed - fully inferred!
 * const db = await DexBee.connect('myapp', schema)
 * const users = db.table('users')
 *
 * // Fully typed!
 * await users.insert({
 *   name: 'John',
 *   email: 'john@example.com',
 * })
 * ```
 */
export function defineSchema<const T extends DatabaseSchema>(schema: T): T {
  return schema
}

/**
 * Type helper to extract the schema type from a defined schema.
 * Useful when you need to reference the schema type separately.
 *
 * @example
 * ```typescript
 * const schema = defineSchema({
 *   version: 1,
 *   tables: {
 *     users: {
 *       schema: {
 *         id: { type: 'number', required: true },
 *         name: { type: 'string', required: true },
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true,
 *     },
 *   },
 * })
 *
 * type MySchema = InferSchema<typeof schema>
 * ```
 */
export type InferSchema<T> = T extends DatabaseSchema ? T : never
