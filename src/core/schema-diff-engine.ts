import type {
  ComplexityReport,
  IndexAddition,
  IndexDrop,
  MigrationOperation,
  SchemaDiff,
  TableModification,
  ValidationResult,
} from '../types/migration'
import type { DatabaseSchema, FieldDefinition, TableConfig } from '../types/schema'
import { DexBeeError, DexBeeErrorCode } from '../types/errors'

export class SchemaDiffEngine {
  /**
   * Generates a comprehensive diff between two database schemas
   */
  generateDiff(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): SchemaDiff {
    const diff: SchemaDiff = {
      tablesAdded: [],
      tablesDropped: [],
      tablesModified: [],
      indexesAdded: [],
      indexesDropped: [],
    }

    const oldTables = new Set(Object.keys(oldSchema.tables))
    const newTables = new Set(Object.keys(newSchema.tables))

    // Find added tables
    for (const tableName of newTables) {
      if (!oldTables.has(tableName)) {
        diff.tablesAdded.push({
          name: tableName,
          ...newSchema.tables[tableName],
        } as TableConfig)
      }
    }

    // Find dropped tables
    for (const tableName of oldTables) {
      if (!newTables.has(tableName)) {
        diff.tablesDropped.push(tableName)
      }
    }

    // Find modified tables
    for (const tableName of newTables) {
      if (oldTables.has(tableName)) {
        const tableModification = this.compareTableConfigs(
          tableName,
          oldSchema.tables[tableName],
          newSchema.tables[tableName],
        )

        if (tableModification) {
          diff.tablesModified.push(tableModification)
        }

        // Check for index changes
        const { indexesAdded, indexesDropped } = this.compareIndexes(
          tableName,
          oldSchema.tables[tableName],
          newSchema.tables[tableName],
        )

        diff.indexesAdded.push(...indexesAdded)
        diff.indexesDropped.push(...indexesDropped)
      }
    }

    return diff
  }

  /**
   * Creates migration operations from a schema diff
   */
  async createMigrationOperations(diff: SchemaDiff): Promise<MigrationOperation[]> {
    const operations: MigrationOperation[] = []

    // Dynamic imports for operation classes
    const { AddTableOperation } = await import('../migration/operations/add-table-operation.js')
    const { DropTableOperation } = await import('../migration/operations/drop-table-operation.js')
    const { AddFieldOperation } = await import('../migration/operations/add-field-operation.js')
    const { DropFieldOperation } = await import('../migration/operations/drop-field-operation.js')
    const { AlterFieldOperation } = await import('../migration/operations/alter-field-operation.js')
    const { AddIndexOperation, DropIndexOperation } = await import('../migration/operations/add-index-operation.js')

    // Add tables first
    for (const tableConfig of diff.tablesAdded) {
      const tableName = (tableConfig as any).name || 'unknown_table'
      operations.push(new AddTableOperation(
        tableName,
        tableConfig,
      ))
    }

    // Add fields to existing tables
    for (const modification of diff.tablesModified) {
      for (const fieldAddition of modification.fieldsAdded) {
        operations.push(new AddFieldOperation(
          modification.tableName,
          fieldAddition.fieldName,
          fieldAddition.fieldDefinition,
        ))
      }
    }

    // Modify existing fields
    for (const modification of diff.tablesModified) {
      for (const fieldModification of modification.fieldsModified) {
        operations.push(new AlterFieldOperation(
          modification.tableName,
          fieldModification.fieldName,
          fieldModification.oldDefinition,
          fieldModification.newDefinition,
        ))
      }
    }

    // Add indexes
    for (const indexAddition of diff.indexesAdded) {
      operations.push(new AddIndexOperation(
        indexAddition.tableName,
        indexAddition.indexName,
        indexAddition.keyPath,
        indexAddition.options,
      ))
    }

    // Drop indexes
    for (const indexDrop of diff.indexesDropped) {
      operations.push(new DropIndexOperation(
        indexDrop.tableName,
        indexDrop.indexName,
      ))
    }

    // Drop fields from existing tables
    for (const modification of diff.tablesModified) {
      for (const fieldName of modification.fieldsDropped) {
        operations.push(new DropFieldOperation(
          modification.tableName,
          fieldName,
        ))
      }
    }

    // Drop tables last
    for (const tableName of diff.tablesDropped) {
      operations.push(new DropTableOperation(tableName))
    }

    return operations
  }

  /**
   * Validates the safety of migration operations
   */
  validateMigrationSafety(operations: MigrationOperation[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    // Check for destructive operations
    const destructiveOperations = operations.filter(op =>
      op.type === 'dropTable' || op.type === 'dropField',
    )

    if (destructiveOperations.length > 0) {
      result.warnings.push(
        `Found ${destructiveOperations.length} potentially destructive operations. `
        + `Ensure you have backups before proceeding.`,
      )
    }

    // Check for operations that might cause data loss
    const dataLossOperations = operations.filter(op =>
      op.type === 'alterField' && this.couldCauseDataLoss(op),
    )

    if (dataLossOperations.length > 0) {
      result.warnings.push(
        `Found ${dataLossOperations.length} field alterations that might cause data loss. `
        + `Consider data transformation operations.`,
      )
    }

    // Validate operation sequence
    try {
      this.validateOperationSequence(operations)
    }
    catch (error) {
      result.isValid = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown validation error')
    }

    return result
  }

  /**
   * Estimates the complexity and duration of migrations
   */
  estimateMigrationComplexity(operations: MigrationOperation[]): ComplexityReport {
    let score = 0
    const factors: string[] = []
    let estimatedDuration = 0

    for (const operation of operations) {
      switch (operation.type) {
        case 'addTable': {
          score += 2
          estimatedDuration += 100 // 100ms base
          factors.push('Table creation')
          break
        }
        case 'dropTable': {
          score += 4
          estimatedDuration += 500 // 500ms base
          factors.push('Table deletion (destructive)')
          break
        }
        case 'addField': {
          score += 1
          estimatedDuration += 50
          factors.push('Field addition')
          break
        }
        case 'dropField': {
          score += 3
          estimatedDuration += 200
          factors.push('Field deletion (destructive)')
          break
        }
        case 'alterField': {
          score += 5
          estimatedDuration += 1000
          factors.push('Field modification (complex)')
          break
        }
        case 'transformData': {
          score += 7
          estimatedDuration += 5000
          factors.push('Data transformation (high complexity)')
          break
        }
        case 'addIndex': {
          score += 2
          estimatedDuration += 200
          factors.push('Index creation')
          break
        }
        case 'dropIndex': {
          score += 1
          estimatedDuration += 100
          factors.push('Index deletion')
          break
        }
      }
    }

    // Normalize score to 1-10 scale
    const normalizedScore = Math.min(10, Math.max(1, Math.ceil(score / operations.length)))

    let riskLevel: 'low' | 'medium' | 'high'
    if (normalizedScore <= 3) {
      riskLevel = 'low'
    }
    else if (normalizedScore <= 6) {
      riskLevel = 'medium'
    }
    else {
      riskLevel = 'high'
    }

    return {
      score: normalizedScore,
      factors: [...new Set(factors)], // Remove duplicates
      estimatedDuration,
      riskLevel,
    }
  }

  /**
   * Compares two table configurations and returns modifications
   */
  private compareTableConfigs(
    tableName: string,
    oldConfig: any,
    newConfig: any,
  ): TableModification | null {
    const modification: TableModification = {
      tableName,
      fieldsAdded: [],
      fieldsDropped: [],
      fieldsModified: [],
    }

    const oldFields = new Set(Object.keys(oldConfig.schema || {}))
    const newFields = new Set(Object.keys(newConfig.schema || {}))

    // Find added fields
    for (const fieldName of newFields) {
      if (!oldFields.has(fieldName)) {
        modification.fieldsAdded.push({
          fieldName,
          fieldDefinition: newConfig.schema[fieldName],
        })
      }
    }

    // Find dropped fields
    for (const fieldName of oldFields) {
      if (!newFields.has(fieldName)) {
        modification.fieldsDropped.push(fieldName)
      }
    }

    // Find modified fields
    for (const fieldName of newFields) {
      if (oldFields.has(fieldName)) {
        const oldField = oldConfig.schema[fieldName]
        const newField = newConfig.schema[fieldName]

        if (!this.areFieldDefinitionsEqual(oldField, newField)) {
          modification.fieldsModified.push({
            fieldName,
            oldDefinition: oldField,
            newDefinition: newField,
          })
        }
      }
    }

    // Return null if no modifications found
    if (
      modification.fieldsAdded.length === 0
      && modification.fieldsDropped.length === 0
      && modification.fieldsModified.length === 0
    ) {
      return null
    }

    return modification
  }

  /**
   * Compares indexes between two table configurations
   */
  private compareIndexes(
    tableName: string,
    oldConfig: any,
    newConfig: any,
  ): { indexesAdded: IndexAddition[], indexesDropped: IndexDrop[] } {
    const indexesAdded: IndexAddition[] = []
    const indexesDropped: IndexDrop[] = []

    const oldIndexes = new Set(oldConfig.indexes || [])
    const newIndexes = new Set(newConfig.indexes || [])

    // For now, simple string comparison
    // In a more sophisticated implementation, we'd parse index definitions
    for (const indexName of newIndexes) {
      if (!oldIndexes.has(indexName)) {
        indexesAdded.push({
          tableName,
          indexName: indexName as string,
          keyPath: indexName as string, // Simplified
          options: {},
        })
      }
    }

    for (const indexName of oldIndexes) {
      if (!newIndexes.has(indexName)) {
        indexesDropped.push({
          tableName,
          indexName: indexName as string,
        })
      }
    }

    return { indexesAdded, indexesDropped }
  }

  /**
   * Checks if two field definitions are equal
   */
  private areFieldDefinitionsEqual(oldField: FieldDefinition, newField: FieldDefinition): boolean {
    return JSON.stringify(oldField) === JSON.stringify(newField)
  }

  /**
   * Checks if a field alteration could cause data loss
   */
  private couldCauseDataLoss(operation: MigrationOperation): boolean {
    // This would be implemented based on the specific operation details
    // For now, we'll assume any field alteration could cause data loss
    return operation.type === 'alterField'
  }

  /**
   * Validates that operations are in a safe sequence
   */
  private validateOperationSequence(operations: MigrationOperation[]): void {
    const tableCreations = new Set<string>()
    const tableDeletions = new Set<string>()

    for (const operation of operations) {
      switch (operation.type) {
        case 'addTable': {
          tableCreations.add(operation.tableName)
          break
        }
        case 'dropTable': {
          tableDeletions.add(operation.tableName)
          break
        }
        case 'addField':
        case 'dropField':
        case 'alterField': {
          // Check if table exists or will be created
          if (tableDeletions.has(operation.tableName)) {
            throw new DexBeeError(
              DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
              `Cannot modify field in table '${operation.tableName}' that will be dropped`,
            )
          }
          break
        }
      }
    }

    // Check for tables that are both created and dropped
    for (const tableName of tableCreations) {
      if (tableDeletions.has(tableName)) {
        throw new DexBeeError(
          DexBeeErrorCode.MIGRATION_VALIDATION_FAILED,
          `Table '${tableName}' is both created and dropped in the same migration`,
        )
      }
    }
  }
}
