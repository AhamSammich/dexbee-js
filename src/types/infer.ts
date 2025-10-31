/**
 * Type utilities for inferring TypeScript types from DexBee schema definitions.
 * These types enable full type safety when working with typed database instances.
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
 *         email: { type: 'string' },
 *       },
 *       primaryKey: 'id',
 *       autoIncrement: true,
 *     },
 *   },
 * })
 *
 * // Infer the User type
 * type User = InferTableType<typeof schema, 'users'>
 * // { id: number; name: string; email?: string }
 * ```
 */

import type {
  DatabaseSchema,
  ExtendedFieldDefinition,
  FieldType,
  TableSchema,
} from './schema.js'

/**
 * Helper type to expand/flatten complex types for better IDE tooltip display.
 * Converts intersection types and mapped types into a single flat object type.
 *
 * @example
 * ```typescript
 * type Complex = { a: string } & { b: number }
 * type Flat = Expand<Complex>
 * // Hover shows: { a: string; b: number }
 * ```
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

/**
 * Built-in types that should not be recursively expanded.
 */
type Builtin
  = string
    | number
    | boolean
    | bigint
    | symbol
    | undefined
    | null
    | ((...args: any[]) => any)
    | Date
    | RegExp
    | Error
    | Array<any>
    | Map<any, any>
    | Set<any>
    | WeakMap<any, any>
    | WeakSet<any>
    | Promise<any>
    | Blob
    | File
    | ArrayBuffer

/**
 * Deeply expands nested types for even better tooltip clarity.
 * Recursively flattens all nested objects while preserving built-in types.
 */
export type ExpandRecursively<T> = T extends Builtin
  ? T
  : T extends object
    ? T extends infer O
      ? { [K in keyof O]: ExpandRecursively<O[K]> }
      : never
    : T

/**
 * Maps field types to their corresponding TypeScript types.
 */
interface FieldTypeMap {
  string: string
  number: number
  boolean: boolean
  date: Date
  object: Record<string, any>
  array: any[]
  blob: Blob
  file: File
  arraybuffer: ArrayBuffer
}

/**
 * Infers the TypeScript type for a single field definition.
 * Handles required/optional fields, nullable fields, and maps DexBee field types to TS types.
 *
 * Type inference rules:
 * - required: true, nullable: false → T
 * - required: true, nullable: true → T | null
 * - required: false, nullable: false → T | undefined
 * - required: false, nullable: true (default) → T | null | undefined
 */
export type InferFieldType<F extends ExtendedFieldDefinition>
  = F extends { type: infer T extends FieldType }
    ? F extends { required: true }
      ? F extends { nullable: false }
        ? FieldTypeMap[T] // required, non-nullable
        : FieldTypeMap[T] | null // required, nullable (default)
      : F extends { nullable: false }
        ? FieldTypeMap[T] | undefined // optional, non-nullable
        : FieldTypeMap[T] | null | undefined // optional, nullable (default)
    : never

/**
 * Helper type to determine if a field should be optional.
 * A field is optional if it doesn't have `required: true`.
 */
type OptionalKeys<S extends TableSchema> = {
  [K in keyof S]: S[K] extends { required: true } ? never : K
}[keyof S]

/**
 * Helper type to determine if a field should be required.
 * A field is required if it has `required: true`.
 */
type RequiredKeys<S extends TableSchema> = {
  [K in keyof S]: S[K] extends { required: true } ? K : never
}[keyof S]

/**
 * Infers the TypeScript type for a complete table schema.
 * Transforms all field definitions into their corresponding TS types.
 * Makes fields optional or required based on the `required` property.
 *
 * @example
 * ```typescript
 * type UserSchema = InferSchemaType<{
 *   id: { type: 'number', required: true }
 *   name: { type: 'string', required: true }
 *   email: { type: 'string' }
 * }>
 * // { id: number; name: string; email?: string }
 * ```
 */
export type InferSchemaType<S extends TableSchema> = {
  [K in RequiredKeys<S>]: InferFieldType<S[K]>
} & {
  [K in OptionalKeys<S>]?: InferFieldType<S[K]>
}

/**
 * Infers the TypeScript type for a table based on its configuration.
 * This is the main type used for table operations.
 * The result is expanded for cleaner IDE tooltips.
 *
 * @example
 * ```typescript
 * type UserTable = InferTableType<typeof mySchema, 'users'>
 * // Hover shows: { id: number; name: string; email?: string }
 * ```
 */
export type InferTableType<
  Schema extends DatabaseSchema,
  TableName extends keyof Schema['tables'],
> = Expand<InferSchemaType<Schema['tables'][TableName]['schema']>>

/**
 * Maps all table names to their inferred types.
 * This creates a type-safe mapping of table names to record types.
 *
 * @example
 * ```typescript
 * type Tables = InferDatabaseTables<typeof schema>
 * // { users: User, posts: Post, ... }
 * ```
 */
export type InferDatabaseTables<Schema extends DatabaseSchema> = {
  [TableName in keyof Schema['tables']]: InferTableType<Schema, TableName>
}

/**
 * Extracts the table names from a database schema as a string union type.
 *
 * @example
 * ```typescript
 * type TableNames = ExtractTableNames<typeof schema>
 * // 'users' | 'posts' | 'comments'
 * ```
 */
export type ExtractTableNames<Schema extends DatabaseSchema> = Extract<
  keyof Schema['tables'],
  string
>

/**
 * Type for insert operations - makes auto-increment primary keys optional.
 * All other required fields must be provided.
 *
 * @example
 * ```typescript
 * type UserInsert = InsertType<typeof schema, 'users'>
 * // If users table has autoIncrement: true with primaryKey: 'id'
 * // and User has { id: number; name: string; email: string; age?: number }
 * // result is:
 * // { id?: number; name: string; email: string; age?: number }
 * ```
 */
export type InsertType<
  Schema extends DatabaseSchema,
  TableName extends keyof Schema['tables'],
> = Schema['tables'][TableName] extends { autoIncrement: true, primaryKey: infer PK }
  ? PK extends keyof InferTableType<Schema, TableName>
    ? Omit<InferTableType<Schema, TableName>, PK> & Partial<Pick<InferTableType<Schema, TableName>, PK>>
    : InferTableType<Schema, TableName>
  : InferTableType<Schema, TableName>
