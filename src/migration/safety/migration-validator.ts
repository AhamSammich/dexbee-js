import type {
  IntegrityResult,
  MigrationOperation,
  MigrationPlan,
  RollbackValidation,
  ValidationResult,
} from '../../types/migration'

export class MigrationValidator {
  /**
   * Validate a complete migration plan
   */
  validateMigrationPlan(plan: MigrationPlan): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    try {
      // Validate plan structure
      if (!plan.version || typeof plan.version !== 'number') {
        result.isValid = false
        result.errors.push('Migration plan must have a valid version number')
      }

      if (!plan.operations || !Array.isArray(plan.operations)) {
        result.isValid = false
        result.errors.push('Migration plan must have operations array')
      }

      if (plan.operations.length === 0) {
        result.warnings.push('Migration plan has no operations')
      }

      // Validate individual operations
      for (let i = 0; i < plan.operations.length; i++) {
        const operation = plan.operations[i]
        const operationResult = this.validateOperation(operation, i)

        if (!operationResult.isValid) {
          result.isValid = false
          result.errors.push(...operationResult.errors.map(err => `Operation ${i}: ${err}`))
        }

        result.warnings.push(...operationResult.warnings.map(warn => `Operation ${i}: ${warn}`))
      }

      // Check for operation conflicts
      const conflictResult = this.checkOperationConflicts(plan.operations)
      if (!conflictResult.isValid) {
        result.isValid = false
        result.errors.push(...conflictResult.errors)
      }
      result.warnings.push(...conflictResult.warnings)

      // Validate operation sequence
      const sequenceResult = this.validateOperationSequence(plan.operations)
      if (!sequenceResult.isValid) {
        result.isValid = false
        result.errors.push(...sequenceResult.errors)
      }
      result.warnings.push(...sequenceResult.warnings)
    }
    catch (error) {
      result.isValid = false
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Check data integrity for a table
   */
  async checkDataIntegrity(tableName: string): Promise<IntegrityResult> {
    const result: IntegrityResult = {
      passed: true,
      tableName,
      recordCount: 0,
      errors: [],
    }

    try {
      // This would perform actual data integrity checks:
      // 1. Count records
      // 2. Check for duplicate primary keys
      // 3. Validate foreign key constraints
      // 4. Check for orphaned records
      // 5. Validate field types and constraints

      console.info(`Checking data integrity for table '${tableName}'`)

      // Placeholder implementation
      result.recordCount = 0 // Would be actual count
      result.passed = true
    }
    catch (error) {
      result.passed = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown integrity check error')
    }

    return result
  }

  /**
   * Validate rollback capability for operations
   */
  validateRollbackCapability(operations: MigrationOperation[]): RollbackValidation {
    const result: RollbackValidation = {
      canRollback: true,
      missingRollbackOperations: [],
      warnings: [],
    }

    for (const operation of operations) {
      if (!operation.rollback) {
        result.canRollback = false
        result.missingRollbackOperations.push(
          `${operation.type} operation on ${operation.tableName}`,
        )
      }

      // Check for operations that are difficult to rollback
      if (operation.type === 'transformData') {
        result.warnings.push(
          `Data transformation on ${operation.tableName} may not be fully reversible`,
        )
      }

      if (operation.type === 'dropTable' || operation.type === 'dropField') {
        result.warnings.push(
          `${operation.type} on ${operation.tableName} will cause data loss if rolled back`,
        )
      }
    }

    return result
  }

  /**
   * Validate individual operation
   */
  private validateOperation(operation: MigrationOperation, index: number): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    // Check required properties
    if (!operation.type) {
      result.isValid = false
      result.errors.push('Operation must have a type')
    }

    if (!operation.tableName) {
      result.isValid = false
      result.errors.push('Operation must have a tableName')
    }

    if (!operation.execute || typeof operation.execute !== 'function') {
      result.isValid = false
      result.errors.push('Operation must have an execute function')
    }

    // Check for destructive operations
    if (['dropTable', 'dropField', 'transformData'].includes(operation.type)) {
      result.warnings.push(`Potentially destructive operation: ${operation.type}`)
    }

    // Validate operation-specific requirements
    switch (operation.type) {
      case 'addTable': {
        // Would validate table configuration
        break
      }
      case 'addField':
      case 'dropField':
      case 'alterField': {
        // Would validate field specifications
        break
      }
      case 'transformData': {
        // Would validate transformation functions
        result.warnings.push('Data transformation may be irreversible')
        break
      }
    }

    return result
  }

  /**
   * Check for conflicts between operations
   */
  private checkOperationConflicts(operations: MigrationOperation[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    const tableOperations = new Map<string, MigrationOperation[]>()

    // Group operations by table
    for (const operation of operations) {
      if (!tableOperations.has(operation.tableName)) {
        tableOperations.set(operation.tableName, [])
      }
      tableOperations.get(operation.tableName)!.push(operation)
    }

    // Check for conflicts within each table
    for (const [tableName, ops] of tableOperations) {
      const conflictResult = this.checkTableOperationConflicts(tableName, ops)
      if (!conflictResult.isValid) {
        result.isValid = false
        result.errors.push(...conflictResult.errors)
      }
      result.warnings.push(...conflictResult.warnings)
    }

    return result
  }

  /**
   * Check conflicts for operations on a single table
   */
  private checkTableOperationConflicts(tableName: string, operations: MigrationOperation[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    const addTable = operations.find(op => op.type === 'addTable')
    const dropTable = operations.find(op => op.type === 'dropTable')

    // Check for add/drop table conflicts
    if (addTable && dropTable) {
      result.isValid = false
      result.errors.push(`Table ${tableName} is both added and dropped in the same migration`)
    }

    // Check for field operations on dropped tables
    if (dropTable) {
      const fieldOperations = operations.filter(op =>
        ['addField', 'dropField', 'alterField'].includes(op.type),
      )

      if (fieldOperations.length > 0) {
        result.isValid = false
        result.errors.push(`Cannot perform field operations on table ${tableName} that will be dropped`)
      }
    }

    // Check for duplicate field operations
    const fieldNames = new Map<string, string[]>()
    for (const operation of operations) {
      if (['addField', 'dropField', 'alterField'].includes(operation.type)) {
        const fieldName = (operation as any).fieldName
        if (fieldName) {
          if (!fieldNames.has(fieldName)) {
            fieldNames.set(fieldName, [])
          }
          fieldNames.get(fieldName)!.push(operation.type)
        }
      }
    }

    for (const [fieldName, operationTypes] of fieldNames) {
      if (operationTypes.length > 1) {
        result.warnings.push(`Multiple operations on field ${fieldName} in table ${tableName}: ${operationTypes.join(', ')}`)
      }
    }

    return result
  }

  /**
   * Validate the sequence of operations
   */
  private validateOperationSequence(operations: MigrationOperation[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    // Operations should generally be in order:
    // 1. Add tables
    // 2. Add fields and indexes
    // 3. Transform data
    // 4. Alter fields
    // 5. Drop fields and indexes
    // 6. Drop tables

    const operationOrder = {
      addTable: 1,
      addField: 2,
      addIndex: 2,
      transformData: 3,
      alterField: 4,
      dropField: 5,
      dropIndex: 5,
      dropTable: 6,
    }

    let lastOrder = 0
    for (const operation of operations) {
      const currentOrder = operationOrder[operation.type as keyof typeof operationOrder] || 999

      if (currentOrder < lastOrder) {
        result.warnings.push(
          `Operation ${operation.type} on ${operation.tableName} may be out of recommended order`,
        )
      }

      lastOrder = Math.max(lastOrder, currentOrder)
    }

    return result
  }
}
