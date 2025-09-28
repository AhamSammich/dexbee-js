import type { MigrationRecord } from '../types/migration'
import { DexBeeError, DexBeeErrorCode } from '../types/errors'

/**
 * Manages migration history tracking in IndexedDB
 */
export class MigrationHistoryManager {
  private static readonly HISTORY_STORE_NAME = '__dexbee_migrations'
  private dbName: string

  constructor(dbName: string) {
    this.dbName = dbName
  }

  /**
   * Record a completed migration
   */
  async recordMigration(record: MigrationRecord): Promise<void> {
    try {
      const db = await this.ensureMigrationStore()

      const transaction = db.transaction([MigrationHistoryManager.HISTORY_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(MigrationHistoryManager.HISTORY_STORE_NAME)

      const migrationRecord = {
        ...record,
        appliedAt: new Date(record.appliedAt), // Ensure Date object
        id: `migration_${record.version}_${Date.now()}`, // Unique ID
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.add(migrationRecord)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(request.error?.message || 'Failed to record migration'))
      })

      db.close()
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_HISTORY_FAILED,
        `Failed to record migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Get complete migration history
   */
  async getMigrationHistory(): Promise<MigrationRecord[]> {
    try {
      const db = await this.ensureMigrationStore()

      const transaction = db.transaction([MigrationHistoryManager.HISTORY_STORE_NAME], 'readonly')
      const store = transaction.objectStore(MigrationHistoryManager.HISTORY_STORE_NAME)

      const records = await new Promise<MigrationRecord[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => {
          const records = request.result.map((record: any) => ({
            version: record.version,
            appliedAt: new Date(record.appliedAt),
            checksum: record.checksum,
            duration: record.duration,
          }))
          resolve(records)
        }
        request.onerror = () => reject(new Error(request.error?.message || 'Failed to get migration history'))
      })

      db.close()

      // Sort by version
      return records.sort((a, b) => a.version - b.version)
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_HISTORY_FAILED,
        `Failed to get migration history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Validate that migration chain is consistent
   */
  async validateMigrationChain(targetVersion: number): Promise<boolean> {
    try {
      const history = await this.getMigrationHistory()

      // Check for gaps in version sequence
      const versions = history.map(record => record.version).sort((a, b) => a - b)

      for (let i = 1; i < versions.length; i++) {
        if (versions[i] !== versions[i - 1] + 1) {
          console.warn(`Migration chain gap detected: missing version ${versions[i - 1] + 1}`)
          return false
        }
      }

      // Check that we don't exceed target version
      const maxVersion = Math.max(...versions)
      if (maxVersion > targetVersion) {
        console.warn(`Migration chain exceeds target version: ${maxVersion} > ${targetVersion}`)
        return false
      }

      return true
    }
    catch (error) {
      console.error('Failed to validate migration chain:', error)
      return false
    }
  }

  /**
   * Get the last applied migration version
   */
  async getLastAppliedVersion(): Promise<number> {
    try {
      const history = await this.getMigrationHistory()

      if (history.length === 0) {
        // If no migration history exists, try to infer from the database version
        // This is a fallback for databases created without explicit migration tracking
        try {
          const db = await this.getMainDatabase()
          const version = db.version
          db.close()
          return version
        }
        catch (error) {
          console.warn('Failed to get database version:', error)
          return 0
        }
      }

      return Math.max(...history.map(record => record.version))
    }
    catch (error) {
      console.error('Failed to get last applied version:', error)
      return 0
    }
  }

  /**
   * Get specific migration record by version
   */
  async getMigrationRecord(version: number): Promise<MigrationRecord | null> {
    try {
      const history = await this.getMigrationHistory()
      return history.find(record => record.version === version) || null
    }
    catch (error) {
      console.error(`Failed to get migration record for version ${version}:`, error)
      return null
    }
  }

  /**
   * Clear migration history (dangerous operation)
   */
  async clearHistory(): Promise<void> {
    try {
      const db = await this.ensureMigrationStore()

      const transaction = db.transaction([MigrationHistoryManager.HISTORY_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(MigrationHistoryManager.HISTORY_STORE_NAME)

      await new Promise<void>((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(request.error?.message || 'Failed to clear migration history'))
      })

      db.close()

      console.warn('Migration history cleared - this may cause migration inconsistencies')
    }
    catch (error) {
      throw new DexBeeError(
        DexBeeErrorCode.MIGRATION_HISTORY_FAILED,
        `Failed to clear migration history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Get access to the main database to check version
   */
  private async getMainDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName)

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Failed to open main database'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      // Don't handle onupgradeneeded - we just want to read the current version
    })
  }

  /**
   * Ensure the migration history store exists
   */
  private async ensureMigrationStore(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Open database with a special version for migration history
      const request = indexedDB.open(`${this.dbName}_migrations`, 1)

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Failed to open migration history database'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(MigrationHistoryManager.HISTORY_STORE_NAME)) {
          const store = db.createObjectStore(MigrationHistoryManager.HISTORY_STORE_NAME, {
            keyPath: 'id',
            autoIncrement: false,
          })

          // Create indexes for efficient querying
          store.createIndex('version', 'version', { unique: false })
          store.createIndex('appliedAt', 'appliedAt', { unique: false })
        }
      }
    })
  }
}
