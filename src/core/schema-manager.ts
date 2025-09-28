import type {
  DatabaseSchema,
  FieldDefinition,
  FieldType,
  Migration,
  RelationshipDefinition,
  TableConfig,
} from '../types/schema.js'
import type { ISchemaManager } from './interfaces.js'
import { DexBeeError, DexBeeErrorCode } from '../types/errors.js'

export class SchemaManager implements ISchemaManager {
  private readonly validFieldTypes: FieldType[] = [
    'string',
    'number',
    'boolean',
    'date',
    'object',
    'array',
  ]

  constructor(public readonly schema: DatabaseSchema) {}

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

  private validateFieldDefinition(
    tableName: string,
    fieldName: string,
    fieldDef: FieldDefinition,
  ): void {
    if (!this.validFieldTypes.includes(fieldDef.type)) {
      throw new DexBeeError(
        DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
        `Invalid field type '${fieldDef.type}' for field '${fieldName}' in table '${tableName}'. Valid types: ${this.validFieldTypes.join(', ')}`,
      )
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
        && (value === undefined || value === null)
        && !isAutoIncrementPrimaryKey
      ) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Required field '${fieldName}' is missing in table '${tableName}'`,
        )
      }

      // Skip type checking for undefined/null values of optional fields
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

      // Custom validation
      if (fieldDef.validate && !fieldDef.validate(value)) {
        throw new DexBeeError(
          DexBeeErrorCode.SCHEMA_VALIDATION_FAILED,
          `Field '${fieldName}' in table '${tableName}' failed custom validation`,
        )
      }
    })
  }

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
        )
      }
      case 'array': {
        return Array.isArray(value)
      }
      default: {
        return false
      }
    }
  }
}
