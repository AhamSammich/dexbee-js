import type { DatabaseSchema, TableConfig } from './schema'

export type MigrationOperationType
  = | 'addTable'
    | 'dropTable'
    | 'addField'
    | 'dropField'
    | 'alterField'
    | 'addIndex'
    | 'dropIndex'

export interface MigrationOperation {
  type: MigrationOperationType
  tableName: string
  execute: (db: IDBDatabase) => Promise<void>
  validate?: (oldSchema: DatabaseSchema, newSchema: DatabaseSchema) => void
}

export interface MigrationPlan {
  version: number
  operations: MigrationOperation[]
  dependencies: string[]
  estimatedDuration: number
}

export interface SchemaDiff {
  tablesAdded: TableConfig[]
  tablesDropped: string[]
  tablesModified: TableModification[]
  indexesAdded: IndexAddition[]
  indexesDropped: IndexDrop[]
}

export interface TableModification {
  tableName: string
  fieldsAdded: FieldAddition[]
  fieldsDropped: string[]
  fieldsModified: FieldModification[]
}

export interface FieldAddition {
  fieldName: string
  fieldDefinition: any // Will be properly typed when we reference FieldDefinition
}

export interface FieldModification {
  fieldName: string
  oldDefinition: any
  newDefinition: any
}

export interface IndexAddition {
  tableName: string
  indexName: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

export interface IndexDrop {
  tableName: string
  indexName: string
}

export interface MigrationOptions {
  dryRun?: boolean
  validateEachStep?: boolean
  batchSize?: number
}

export interface MigrationResult {
  success: boolean
  version: number
  operationsExecuted: number
  duration: number
  errors?: Error[]
}

export interface DryRunResult {
  isValid: boolean
  estimatedDuration: number
  operations: MigrationOperation[]
  warnings: string[]
  errors: string[]
}

export interface MigrationStatus {
  currentVersion: number
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface IntegrityResult {
  passed: boolean
  tableName: string
  recordCount: number
  errors: string[]
}

export interface ComplexityReport {
  score: number // 1-10 scale
  factors: string[]
  estimatedDuration: number
  riskLevel: 'low' | 'medium' | 'high'
}
