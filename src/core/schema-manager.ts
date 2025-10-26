import type {
  BlobFieldDefinition,
  DatabaseSchema,
  ExtendedFieldDefinition,
  FieldType,
  Migration,
  RelationshipDefinition,
  TableConfig,
} from '../types/schema.js'
import type { ISchemaManager } from './interfaces.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'

/**
 * Manages database schema validation, migrations, and data validation.
 * Ensures schema integrity and provides validation for field definitions and data.
 */
export class SchemaManager implements ISchemaManager {
  private readonly validFieldTypes: FieldType[] = [
    'string',
    'number',
    'boolean',
    'date',
    'object',
    'array',
    'blob',
    'file',
    'arraybuffer',
  ]

  /**
   * Creates a new SchemaManager instance.
   *
   * @param schema - The database schema to manage and validate
   */
  constructor(public readonly schema: DatabaseSchema) {}

  /**
   * Validates the entire database schema structure.
   * Checks version, table definitions, field types, relationships, and indexes.
   *
   * @throws {DexBeeError} When schema is invalid or contains errors
   *
   * @example
   * ```typescript
   * const schemaManager = new SchemaManager(mySchema)
   * try {
   *   schemaManager.validateSchema()
   *   console.log('Schema is valid')
   * } catch (error) {
   *   console.error('Schema validation failed:', error.message)
   * }
   * ```
   */
  validateSchema(): void {
    if (!this.schema.version || this.schema.version < 1) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        'Schema version must be a positive number',
      )
    }

    if (!this.schema.tables || Object.keys(this.schema.tables).length === 0) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        'Schema must have at least one table',
      )
    }

    Object.entries(this.schema.tables).forEach(([tableName, config]) => {
      this.validateTableConfig(tableName, config)
    })

    // Validate relationships after all tables are validated
    Object.entries(this.schema.tables).forEach(([tableName, config]) => {
      if (config.relationships) {
        this.validateRelationships(tableName, config.relationships)
      }
    })
  }

  /**
   * Validates a single table configuration.
   * Checks field definitions, primary key, and index configurations.
   *
   * @private
   * @param tableName - Name of the table being validated
   * @param config - Table configuration to validate
   * @throws {DexBeeError} When table configuration is invalid
   */
  private validateTableConfig(tableName: string, config: TableConfig): void {
    if (!config.schema || Object.keys(config.schema).length === 0) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Table '${tableName}' must have at least one field in schema`,
      )
    }

    // Validate primary key exists in schema
    if (config.primaryKey && !config.schema[config.primaryKey]) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Primary key '${config.primaryKey}' not found in table '${tableName}' schema`,
      )
    }

    // Validate field definitions
    Object.entries(config.schema).forEach(([fieldName, fieldDef]) => {
      this.validateFieldDefinition(tableName, fieldName, fieldDef)
    })

    // Validate indexes reference existing fields
    if (config.indexes) {
      config.indexes.forEach((index) => {
        const keyPaths = Array.isArray(index.keyPath)
          ? index.keyPath
          : [index.keyPath]
        keyPaths.forEach((keyPath) => {
          if (!config.schema[keyPath]) {
            throw new DexBeeError(
              DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
              `Index '${index.name}' references non-existent field '${keyPath}' in table '${tableName}'`,
            )
          }
        })
      })
    }
  }

  /**
   * Validates a single field definition within a table schema.
   * Checks field type, default functions, validation functions, and foreign key references.
   *
   * @private
   * @param tableName - Name of the table containing the field
   * @param fieldName - Name of the field being validated
   * @param fieldDef - Field definition to validate
   * @throws {DexBeeError} When field definition is invalid
   */
  private validateFieldDefinition(
    tableName: string,
    fieldName: string,
    fieldDef: ExtendedFieldDefinition,
  ): void {
    if (!this.validFieldTypes.includes(fieldDef.type)) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Invalid field type '${fieldDef.type}' for field '${fieldName}' in table '${tableName}'. Valid types: ${this.validFieldTypes.join(', ')}`,
      )
    }

    // Validate blob-specific fields
    if (fieldDef.type === 'blob' || fieldDef.type === 'file' || fieldDef.type === 'arraybuffer') {
      this.validateBlobFieldDefinition(tableName, fieldName, fieldDef as BlobFieldDefinition)
    }

    // Validate default function if present
    if (fieldDef.default && typeof fieldDef.default !== 'function') {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Default value for field '${fieldName}' in table '${tableName}' must be a function`,
      )
    }

    // Validate validation function if present
    if (fieldDef.validate && typeof fieldDef.validate !== 'function') {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Validation function for field '${fieldName}' in table '${tableName}' must be a function`,
      )
    }

    // Validate foreign key references
    if (fieldDef.references) {
      const { table: referencedTable, key: referencedKey = 'id' }
        = fieldDef.references

      if (!this.schema.tables[referencedTable]) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Foreign key in field '${fieldName}' of table '${tableName}' references non-existent table '${referencedTable}'`,
        )
      }

      if (!this.schema.tables[referencedTable].schema[referencedKey]) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Foreign key in field '${fieldName}' of table '${tableName}' references non-existent field '${referencedKey}' in table '${referencedTable}'`,
        )
      }
    }
  }

  /**
   * Validates the schema definition for blob-type fields (blob, file, arraybuffer).
   * Checks that maxSize is a positive number and allowedTypes is a valid array of strings.
   *
   * @private
   * @param tableName - Name of the table containing the field
   * @param fieldName - Name of the blob field being validated
   * @param fieldDef - The blob field definition to validate
   * @throws {DexBeeError} When blob field definition is invalid
   */
  private validateBlobFieldDefinition(
    tableName: string,
    fieldName: string,
    fieldDef: BlobFieldDefinition,
  ): void {
    // Validate maxSize
    if (fieldDef.maxSize !== undefined && (typeof fieldDef.maxSize !== 'number' || fieldDef.maxSize <= 0)) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `maxSize for blob field '${fieldName}' in table '${tableName}' must be a positive number`,
      )
    }

    // Validate allowedTypes
    if (fieldDef.allowedTypes !== undefined) {
      if (!Array.isArray(fieldDef.allowedTypes)) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `allowedTypes for blob field '${fieldName}' in table '${tableName}' must be an array`,
        )
      }
      if (fieldDef.allowedTypes.some(type => typeof type !== 'string')) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `allowedTypes for blob field '${fieldName}' in table '${tableName}' must contain only strings`,
        )
      }
    }
  }

  /**
   * Validates blob field data against the schema constraints.
   * Checks size limits for all blob types and MIME type restrictions for Blob/File.
   *
   * @private
   * @param tableName - Name of the table containing the field
   * @param fieldName - Name of the blob field being validated
   * @param value - The blob data to validate (Blob, File, or ArrayBuffer)
   * @param fieldDef - The blob field definition with constraints
   * @throws {DexBeeError} When blob data violates schema constraints
   */
  private validateBlobField(
    tableName: string,
    fieldName: string,
    value: Blob | File | ArrayBuffer,
    fieldDef: BlobFieldDefinition,
  ): void {
    // For ArrayBuffer, only check size
    if (value instanceof ArrayBuffer) {
      if (fieldDef.maxSize && value.byteLength > fieldDef.maxSize) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `ArrayBuffer size ${value.byteLength} for field '${fieldName}' in table '${tableName}' exceeds maximum ${fieldDef.maxSize}`,
        )
      }
      return
    }

    // For Blob and File, check size and MIME type
    if (fieldDef.maxSize && value.size > fieldDef.maxSize) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Blob size ${value.size} for field '${fieldName}' in table '${tableName}' exceeds maximum ${fieldDef.maxSize}`,
      )
    }

    if (fieldDef.allowedTypes) {
      // Treat empty strings as invalid MIME types
      if (!value.type || !fieldDef.allowedTypes.includes(value.type)) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `MIME type '${value.type || '(empty)'}' for field '${fieldName}' in table '${tableName}' is not allowed. Allowed types: ${fieldDef.allowedTypes.join(', ')}`,
        )
      }
    }
  }

  /**
   * Validates all relationships defined for a table.
   *
   * @private
   * @param tableName - Name of the table containing relationships
   * @param relationships - Object mapping relationship names to definitions
   * @throws {DexBeeError} When any relationship is invalid
   */
  private validateRelationships(
    tableName: string,
    relationships: { [key: string]: RelationshipDefinition },
  ): void {
    Object.entries(relationships).forEach(
      ([relationshipName, relationship]) => {
        this.validateRelationship(tableName, relationshipName, relationship)
      },
    )
  }

  /**
   * Validates a single relationship definition.
   * Checks that referenced tables and fields exist, and validates relationship constraints.
   *
   * @private
   * @param tableName - Name of the table containing the relationship
   * @param relationshipName - Name of the relationship being validated
   * @param relationship - Relationship definition to validate
   * @throws {DexBeeError} When relationship definition is invalid
   */
  private validateRelationship(
    tableName: string,
    relationshipName: string,
    relationship: RelationshipDefinition,
  ): void {
    // Validate referenced table exists
    if (!this.schema.tables[relationship.table]) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Relationship '${relationshipName}' in table '${tableName}' references non-existent table '${relationship.table}'`,
      )
    }

    const currentTable = this.schema.tables[tableName]
    const relatedTable = this.schema.tables[relationship.table]

    switch (relationship.type) {
      case 'belongsTo': {
        // For belongsTo, localKey should exist in current table and foreignKey in related table
        const localKey = relationship.localKey || `${relationship.table}Id`
        const foreignKey = relationship.foreignKey || 'id'

        if (!currentTable.schema[localKey]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `belongsTo relationship '${relationshipName}' in table '${tableName}' requires field '${localKey}' which doesn't exist`,
          )
        }

        if (!relatedTable.schema[foreignKey]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `belongsTo relationship '${relationshipName}' in table '${tableName}' references non-existent field '${foreignKey}' in table '${relationship.table}'`,
          )
        }
        break
      }

      case 'hasOne':
      case 'hasMany': {
        // For hasOne/hasMany, foreignKey should exist in related table and localKey in current table
        const localKeyHas = relationship.localKey || 'id'
        const foreignKeyHas = relationship.foreignKey || `${tableName}Id`

        if (!currentTable.schema[localKeyHas]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `${relationship.type} relationship '${relationshipName}' in table '${tableName}' requires field '${localKeyHas}' which doesn't exist`,
          )
        }

        if (!relatedTable.schema[foreignKeyHas]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `${relationship.type} relationship '${relationshipName}' in table '${tableName}' requires field '${foreignKeyHas}' in table '${relationship.table}' which doesn't exist`,
          )
        }
        break
      }

      case 'belongsToMany': {
        // For belongsToMany, validate join table and keys
        if (!relationship.through) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `belongsToMany relationship '${relationshipName}' in table '${tableName}' requires 'through' table specification`,
          )
        }

        if (!this.schema.tables[relationship.through]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `belongsToMany relationship '${relationshipName}' in table '${tableName}' references non-existent join table '${relationship.through}'`,
          )
        }

        const throughTable = this.schema.tables[relationship.through]
        const throughLocalKey = relationship.throughLocalKey || `${tableName}Id`
        const throughForeignKey
          = relationship.throughForeignKey || `${relationship.table}Id`

        if (!throughTable.schema[throughLocalKey]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `belongsToMany relationship '${relationshipName}' requires field '${throughLocalKey}' in join table '${relationship.through}' which doesn't exist`,
          )
        }

        if (!throughTable.schema[throughForeignKey]) {
          throw new DexBeeError(
            DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
            `belongsToMany relationship '${relationshipName}' requires field '${throughForeignKey}' in join table '${relationship.through}' which doesn't exist`,
          )
        }
        break
      }

      default: {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Invalid relationship type '${(relationship as any).type}' for relationship '${relationshipName}' in table '${tableName}'. Valid types: hasOne, hasMany, belongsTo, belongsToMany`,
        )
      }
    }
  }

  /**
   * Applies schema migrations to the database.
   * Creates missing object stores and indexes based on schema definition.
   *
   * @param db - The IndexedDB database instance
   * @param oldVersion - Previous database version
   * @param newVersion - New database version to migrate to
   *
   * @example
   * ```typescript
   * // Called during database upgrade
   * const request = indexedDB.open('mydb', 2)
   * request.onupgradeneeded = (event) => {
   *   const db = event.target.result
   *   schemaManager.applyMigrations(db, event.oldVersion, event.newVersion)
   * }
   * ```
   */
  applyMigrations(
    db: IDBDatabase,
    oldVersion: number,
    newVersion: number,
  ): void {
    // For Phase 1, we'll implement basic schema application
    // Later this will be enhanced with proper migration logic
    Object.entries(this.schema.tables).forEach(([tableName, config]) => {
      if (!db.objectStoreNames.contains(tableName)) {
        this.createObjectStore(db, tableName, config)
      }
    })
  }

  /**
   * Creates an IndexedDB object store based on table configuration.
   * Sets up primary key, auto-increment, and creates all defined indexes.
   *
   * @private
   * @param db - The IndexedDB database instance
   * @param name - Name of the object store to create
   * @param config - Table configuration defining store structure
   */
  private createObjectStore(
    db: IDBDatabase,
    name: string,
    config: TableConfig,
  ): void {
    const storeOptions: IDBObjectStoreParameters = {}

    if (config.primaryKey) {
      storeOptions.keyPath = config.primaryKey
    }

    if (config.autoIncrement) {
      storeOptions.autoIncrement = true
    }

    const store = db.createObjectStore(name, storeOptions)

    // Create indexes
    if (config.indexes) {
      config.indexes.forEach((index) => {
        store.createIndex(index.name, index.keyPath, {
          unique: index.unique || false,
          multiEntry: index.multiEntry || false,
        })
      })
    }
  }

  /**
   * Generates a migration object to transform from old schema to new schema.
   * Currently a placeholder implementation for future migration features.
   *
   * @param oldSchema - The previous database schema
   * @param newSchema - The new database schema to migrate to
   * @returns Migration object with version and up function
   *
   * @example
   * ```typescript
   * const migration = schemaManager.generateMigration(oldSchema, newSchema)
   * console.log(`Generated migration to version ${migration.version}`)
   * ```
   */
  generateMigration(
    oldSchema: DatabaseSchema,
    newSchema: DatabaseSchema,
  ): Migration {
    // Placeholder for Phase 1 - will be implemented in later phases
    return {
      version: newSchema.version,
      up: (db: IDBDatabase) => {
        // Migration logic will be implemented later
        console.log('Migration placeholder')
      },
    }
  }

  /**
   * Validates data against the table schema definition.
   * Checks required fields, data types, blob constraints, and custom validation rules.
   *
   * @param tableName - Name of the table to validate against
   * @param data - The data object to validate
   * @throws {DexBeeError} When data fails validation or table not found
   *
   * @example
   * ```typescript
   * try {
   *   schemaManager.validateData('users', {
   *     name: 'John Doe',
   *     email: 'john@example.com',
   *     age: 30
   *   })
   *   console.log('Data is valid')
   * } catch (error) {
   *   console.error('Validation failed:', error.message)
   * }
   * ```
   */
  validateData(tableName: string, data: any): void {
    const tableConfig = this.schema.tables[tableName]
    if (!tableConfig) {
      throw new DexBeeError(
        DexBeeErrorCode.STORE_NOT_FOUND,
        `Table '${tableName}' not found in schema`,
      )
    }

    Object.entries(tableConfig.schema).forEach(([fieldName, fieldDef]) => {
      const value = data[fieldName]

      // Skip validation for auto-increment primary key fields if they're missing
      const isAutoIncrementPrimaryKey
        = tableConfig.autoIncrement && tableConfig.primaryKey === fieldName

      // Check required fields (except auto-increment primary keys)
      if (
        fieldDef.required
        && value === undefined
        && !isAutoIncrementPrimaryKey
      ) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Required field '${fieldName}' is missing in table '${tableName}'`,
        )
      }

      // Check nullable constraint (defaults to true for backward compatibility)
      const nullable = fieldDef.nullable !== false // true if undefined or true
      if (value === null && !nullable) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Field '${fieldName}' in table '${tableName}' cannot be null (nullable: false)`,
        )
      }

      // Skip type checking for undefined/null values
      if (value === undefined || value === null) {
        return
      }

      // Type validation
      if (!this.isValidType(value, fieldDef.type)) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Field '${fieldName}' in table '${tableName}' must be of type '${fieldDef.type}', got '${typeof value}'`,
        )
      }

      // Blob-specific validation
      if (fieldDef.type === 'blob' || fieldDef.type === 'file' || fieldDef.type === 'arraybuffer') {
        this.validateBlobField(tableName, fieldName, value, fieldDef as BlobFieldDefinition)
      }

      // Custom validation
      if (fieldDef.validate && !fieldDef.validate(value)) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Field '${fieldName}' in table '${tableName}' failed custom validation`,
        )
      }
    })
  }

  /**
   * Applies default values to data based on schema field definitions.
   * Only applies defaults for fields that are undefined in the input data.
   *
   * @param tableName - Name of the table to apply defaults for
   * @param data - The data object to apply defaults to
   * @returns New object with default values applied
   * @throws {DexBeeError} When table is not found in schema
   *
   * @example
   * ```typescript
   * const dataWithDefaults = schemaManager.applyDefaults('users', {
   *   name: 'John Doe',
   *   email: 'john@example.com'
   *   // createdAt will get default value from schema
   * })
   * ```
   */
  applyDefaults(tableName: string, data: any): any {
    const tableConfig = this.schema.tables[tableName]
    if (!tableConfig) {
      throw new DexBeeError(
        DexBeeErrorCode.STORE_NOT_FOUND,
        `Table '${tableName}' not found in schema`,
      )
    }

    const result = { ...data }

    Object.entries(tableConfig.schema).forEach(([fieldName, fieldDef]) => {
      if (result[fieldName] === undefined && fieldDef.default) {
        result[fieldName] = fieldDef.default()
      }
    })

    return result
  }

  /**
   * Checks if a value matches the expected field type.
   * Performs runtime type checking for all supported field types.
   *
   * @private
   * @param value - The value to type-check
   * @param expectedType - The expected field type from schema
   * @returns true if value matches expected type, false otherwise
   */
  private isValidType(value: any, expectedType: FieldType): boolean {
    switch (expectedType) {
      case 'string': {
        return typeof value === 'string'
      }
      case 'number': {
        return typeof value === 'number' && !Number.isNaN(value)
      }
      case 'boolean': {
        return typeof value === 'boolean'
      }
      case 'date': {
        return value instanceof Date
      }
      case 'object': {
        return (
          typeof value === 'object'
          && value !== null
          && !Array.isArray(value)
          && !(value instanceof Date)
          && !(value instanceof Blob)
          && !(value instanceof ArrayBuffer)
        )
      }
      case 'array': {
        return Array.isArray(value)
      }
      case 'blob': {
        return value instanceof Blob
      }
      case 'file': {
        return value instanceof File
      }
      case 'arraybuffer': {
        return value instanceof ArrayBuffer
      }
      default: {
        return false
      }
    }
  }
}
