export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'blob' | 'file' | 'arraybuffer'

export interface RelationshipDefinition {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
  table: string
  foreignKey?: string // Field in related table that references this table
  localKey?: string // Field in this table that references related table
  through?: string // Join table for many-to-many relationships
  throughLocalKey?: string // Key in join table referencing this table
  throughForeignKey?: string // Key in join table referencing related table
}

export interface FieldDefinition {
  type: FieldType
  required?: boolean
  nullable?: boolean // Allow null values (defaults to true for backward compatibility)
  unique?: boolean
  index?: boolean
  default?: () => any
  validate?: (value: any) => boolean
  // Foreign key relationship (for belongsTo relationships)
  references?: {
    table: string
    key?: string // defaults to 'id'
    onDelete?: 'cascade' | 'setNull' | 'restrict'
    onUpdate?: 'cascade' | 'setNull' | 'restrict'
  }
}

export interface BlobFieldDefinition extends Omit<FieldDefinition, 'type'> {
  type: 'blob' | 'file' | 'arraybuffer'
  maxSize?: number // Size limit in bytes
  allowedTypes?: string[] // MIME types for file/blob validation
  generateUrl?: boolean // Auto-generate object URLs for retrieval
  metadata?: {
    trackSize: boolean
    trackType: boolean
    trackLastModified: boolean // For File type
  }
}

export interface BlobMetadata {
  size: number
  type: string
  lastModified?: number
  name?: string
}

export type ExtendedFieldDefinition = FieldDefinition | BlobFieldDefinition

export interface TableSchema {
  [fieldName: string]: ExtendedFieldDefinition
}

export interface IndexDefinition {
  name: string
  keyPath: string | string[]
  unique?: boolean
  multiEntry?: boolean
}

export interface TableConfig<Schema extends TableSchema = TableSchema> {
  schema: Schema
  primaryKey?: string
  autoIncrement?: boolean
  indexes?: IndexDefinition[]
  relationships?: {
    [relationshipName: string]: RelationshipDefinition
  }
}

export interface DatabaseSchema {
  version: number
  tables: Record<string, TableConfig>
}

export interface Migration {
  version: number
  up: (db: IDBDatabase) => void
  down?: (db: IDBDatabase) => void
}
