import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { 
  DexBee, 
  eq, 
  gt, 
  gte, 
  lt, 
  lte, 
  between, 
  inArray, 
  in_, 
  notIn, 
  and, 
  or, 
  not,
  type DatabaseSchema 
} from '../../src/index.js'

interface TestRecord {
  id: number
  name: string
  age: number
  score: number
  status: string
  isActive: boolean
  tags: string[]
  category: string | null
  createdAt: Date
}

const testSchema: DatabaseSchema = {
  version: 1,
  tables: {
    records: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        age: { type: 'number', required: true },
        score: { type: 'number', required: true },
        status: { type: 'string', required: true },
        isActive: { type: 'boolean', default: () => true },
        tags: { type: 'array', default: () => [] },
        category: { type: 'string', required: false },
        createdAt: { type: 'date', default: () => new Date() }
      },
      primaryKey: 'id',
      autoIncrement: true
    }
  }
}

const testData: Omit<TestRecord, 'id' | 'createdAt'>[] = [
  { name: 'Alice', age: 25, score: 85, status: 'active', isActive: true, tags: ['admin', 'user'], category: 'A' },
  { name: 'Bob', age: 30, score: 92, status: 'active', isActive: true, tags: ['user'], category: 'B' },
  { name: 'Charlie', age: 35, score: 78, status: 'inactive', isActive: false, tags: ['user', 'guest'], category: 'A' },
  { name: 'Diana', age: 28, score: 95, status: 'pending', isActive: true, tags: ['admin'], category: 'C' },
  { name: 'Eve', age: 22, score: 88, status: 'active', isActive: true, tags: ['user', 'premium'], category: null },
  { name: 'Frank', age: 40, score: 72, status: 'inactive', isActive: false, tags: [], category: 'B' },
  { name: 'Grace', age: 33, score: 90, status: 'banned', isActive: false, tags: ['user'], category: 'A' }
]

describe('Query Operators Unit Tests', () => {
  let db: any
  let table: any

  beforeEach(async () => {
    // Create a fresh database for each test
    const dbName = `test-operators-${Date.now()}-${Math.random()}`
    db = await DexBee.connect(dbName, testSchema)
    table = db.table<TestRecord>('records')

    // Insert test data
    await table.insertMany(testData)
  })

  afterEach(async () => {
    if (db) {
      await db.close()
    }
  })

  describe('Comparison Operators', () => {
    describe('eq (equality)', () => {
      it('should match exact values', async () => {
        const results = await table.where(eq('name', 'Alice')).all()
        expect(results).toHaveLength(1)
        expect(results[0].name).toBe('Alice')
      })

      it('should match boolean values', async () => {
        const results = await table.where(eq('isActive', false)).all()
        expect(results).toHaveLength(3) // Charlie, Frank, Grace
        expect(results.every((r: TestRecord) => !r.isActive)).toBe(true)
      })

      it('should match null values', async () => {
        const results = await table.where(eq('category', null)).all()
        expect(results).toHaveLength(1)
        expect(results[0].name).toBe('Eve')
      })

      it('should return empty array for no matches', async () => {
        const results = await table.where(eq('name', 'NonExistent')).all()
        expect(results).toHaveLength(0)
      })
    })

    describe('gt (greater than)', () => {
      it('should match values greater than threshold', async () => {
        const results = await table.where(gt('age', 30)).all()
        expect(results).toHaveLength(3) // Charlie (35), Frank (40), Grace (33)
        expect(results.every((r: TestRecord) => r.age > 30)).toBe(true)
      })

      it('should not include equal values', async () => {
        const results = await table.where(gt('age', 30)).all()
        expect(results.some((r: TestRecord) => r.age === 30)).toBe(false)
      })

      it('should work with decimal values', async () => {
        const results = await table.where(gt('score', 89.5)).all()
        expect(results).toHaveLength(3) // Bob (92), Diana (95), Grace (90)
        expect(results.every((r: TestRecord) => r.score > 89.5)).toBe(true)
      })
    })

    describe('gte (greater than or equal)', () => {
      it('should match values greater than or equal to threshold', async () => {
        const results = await table.where(gte('age', 30)).all()
        expect(results).toHaveLength(4) // Bob (30), Charlie (35), Frank (40), Grace (33)
        expect(results.every((r: TestRecord) => r.age >= 30)).toBe(true)
      })

      it('should include equal values', async () => {
        const results = await table.where(gte('age', 30)).all()
        expect(results.some((r: TestRecord) => r.age === 30)).toBe(true)
      })
    })

    describe('lt (less than)', () => {
      it('should match values less than threshold', async () => {
        const results = await table.where(lt('age', 30)).all()
        expect(results).toHaveLength(3) // Alice (25), Diana (28), Eve (22)
        expect(results.every((r: TestRecord) => r.age < 30)).toBe(true)
      })

      it('should not include equal values', async () => {
        const results = await table.where(lt('age', 30)).all()
        expect(results.some((r: TestRecord) => r.age === 30)).toBe(false)
      })
    })

    describe('lte (less than or equal)', () => {
      it('should match values less than or equal to threshold', async () => {
        const results = await table.where(lte('age', 30)).all()
        expect(results).toHaveLength(4) // Alice (25), Bob (30), Diana (28), Eve (22)
        expect(results.every((r: TestRecord) => r.age <= 30)).toBe(true)
      })

      it('should include equal values', async () => {
        const results = await table.where(lte('age', 30)).all()
        expect(results.some((r: TestRecord) => r.age === 30)).toBe(true)
      })
    })

    describe('between (range)', () => {
      it('should match values within inclusive range', async () => {
        const results = await table.where(between('age', 25, 30)).all()
        expect(results).toHaveLength(3) // Alice (25), Bob (30), Diana (28)
        expect(results.every((r: TestRecord) => r.age >= 25 && r.age <= 30)).toBe(true)
      })

      it('should include boundary values', async () => {
        const results = await table.where(between('age', 25, 30)).all()
        expect(results.some((r: TestRecord) => r.age === 25)).toBe(true) // Alice
        expect(results.some((r: TestRecord) => r.age === 30)).toBe(true) // Bob
      })

      it('should work with decimal values', async () => {
        const results = await table.where(between('score', 80, 90)).all()
        expect(results).toHaveLength(3) // Alice (85), Eve (88), Grace (90)
        expect(results.every((r: TestRecord) => r.score >= 80 && r.score <= 90)).toBe(true)
      })

      it('should handle reversed range (min > max)', async () => {
        // The behavior might depend on implementation, but typically should return empty
        const results = await table.where(between('age', 30, 25)).all()
        expect(results).toHaveLength(0)
      })
    })

    describe('inArray (IN operator)', () => {
      it('should match values in the array', async () => {
        const results = await table.where(inArray('status', ['active', 'pending'])).all()
        expect(results).toHaveLength(4) // Alice, Bob, Diana, Eve
        expect(results.every((r: TestRecord) => ['active', 'pending'].includes(r.status))).toBe(true)
      })

      it('should work with single value array', async () => {
        const results = await table.where(inArray('name', ['Alice'])).all()
        expect(results).toHaveLength(1)
        expect(results[0].name).toBe('Alice')
      })

      it('should return empty for empty array', async () => {
        const results = await table.where(inArray('status', [])).all()
        expect(results).toHaveLength(0)
      })

      it('should work with number values', async () => {
        const results = await table.where(inArray('age', [25, 30, 35])).all()
        expect(results).toHaveLength(3) // Alice, Bob, Charlie
        expect(results.every((r: TestRecord) => [25, 30, 35].includes(r.age))).toBe(true)
      })

      it('should work with boolean values', async () => {
        const results = await table.where(inArray('isActive', [true])).all()
        expect(results).toHaveLength(4) // All active users
        expect(results.every((r: TestRecord) => r.isActive)).toBe(true)
      })
    })

    describe('in_ (deprecated alias)', () => {
      it('should work the same as inArray', async () => {
        const inArrayResults = await table.where(inArray('status', ['active', 'pending'])).all()
        const in_Results = await table.where(in_('status', ['active', 'pending'])).all()
        
        expect(in_Results).toHaveLength(inArrayResults.length)
        expect(in_Results.map((r: TestRecord) => r.id).sort()).toEqual(
          inArrayResults.map((r: TestRecord) => r.id).sort()
        )
      })
    })

    describe('notIn (NOT IN operator)', () => {
      it('should match values not in the array', async () => {
        const results = await table.where(notIn('status', ['active', 'pending'])).all()
        expect(results).toHaveLength(3) // Charlie (inactive), Frank (inactive), Grace (banned)
        expect(results.every((r: TestRecord) => !['active', 'pending'].includes(r.status))).toBe(true)
      })

      it('should work with single value array', async () => {
        const results = await table.where(notIn('name', ['Alice'])).all()
        expect(results).toHaveLength(6) // Everyone except Alice
        expect(results.every((r: TestRecord) => r.name !== 'Alice')).toBe(true)
      })

      it('should return all records for empty array', async () => {
        const results = await table.where(notIn('status', [])).all()
        expect(results).toHaveLength(7) // All records
      })

      it('should work with number values', async () => {
        const results = await table.where(notIn('age', [25, 30])).all()
        expect(results).toHaveLength(5) // Everyone except Alice (25) and Bob (30)
        expect(results.every((r: TestRecord) => ![25, 30].includes(r.age))).toBe(true)
      })
    })
  })

  describe('Logical Operators', () => {
    describe('and (logical AND)', () => {
      it('should require all conditions to be true', async () => {
        const results = await table.where(and(
          eq('isActive', true),
          gt('age', 25)
        )).all()
        
        expect(results).toHaveLength(2) // Bob (30), Diana (28) - Eve is 22, not > 25
        expect(results.every((r: TestRecord) => r.isActive && r.age > 25)).toBe(true)
      })

      it('should work with multiple conditions', async () => {
        const results = await table.where(and(
          eq('isActive', true),
          gte('score', 85),
          inArray('category', ['A', 'B', 'C'])
        )).all()
        
        expect(results).toHaveLength(3) // Alice (A, 85), Bob (B, 92), Diana (C, 95)
        expect(results.every((r: TestRecord) => 
          r.isActive && 
          r.score >= 85 && 
          (r.category && ['A', 'B', 'C'].includes(r.category))
        )).toBe(true)
      })

      it('should return empty when no records match all conditions', async () => {
        const results = await table.where(and(
          eq('isActive', true),
          eq('status', 'banned') // No active banned users
        )).all()
        
        expect(results).toHaveLength(0)
      })

      it('should work with single condition', async () => {
        const results = await table.where(and(eq('name', 'Alice'))).all()
        expect(results).toHaveLength(1)
        expect(results[0].name).toBe('Alice')
      })
    })

    describe('or (logical OR)', () => {
      it('should require at least one condition to be true', async () => {
        const results = await table.where(or(
          eq('name', 'Alice'),
          eq('name', 'Bob')
        )).all()
        
        expect(results).toHaveLength(2)
        expect(results.map((r: TestRecord) => r.name).sort()).toEqual(['Alice', 'Bob'])
      })

      it('should work with multiple conditions', async () => {
        const results = await table.where(or(
          eq('status', 'banned'),
          eq('category', null),
          lt('age', 23)
        )).all()
        
        // Grace (banned), Eve (category null), Eve (age 22)
        expect(results).toHaveLength(2) // Eve matches two conditions but only counted once
        expect(results.some((r: TestRecord) => r.status === 'banned')).toBe(true)
        expect(results.some((r: TestRecord) => r.category === null)).toBe(true)
      })

      it('should return all matching records', async () => {
        const results = await table.where(or(
          eq('isActive', true),
          eq('isActive', false)
        )).all()
        
        expect(results).toHaveLength(7) // All records
      })

      it('should work with single condition', async () => {
        const results = await table.where(or(eq('name', 'Alice'))).all()
        expect(results).toHaveLength(1)
        expect(results[0].name).toBe('Alice')
      })
    })

    describe('not (logical NOT)', () => {
      it('should negate a condition', async () => {
        const results = await table.where(not(eq('isActive', true))).all()
        expect(results).toHaveLength(3) // Charlie, Frank, Grace (not active)
        expect(results.every((r: TestRecord) => !r.isActive)).toBe(true)
      })

      it('should negate complex conditions', async () => {
        const results = await table.where(not(and(
          eq('isActive', true),
          gt('age', 25)
        ))).all()
        
        // Should include: inactive users OR active users with age <= 25
        expect(results).toHaveLength(5) // Alice (active, age 25), Eve (active, age 22), Charlie, Frank, Grace (inactive)
        expect(results.every((r: TestRecord) => !r.isActive || r.age <= 25)).toBe(true)
      })

      it('should work with array operators', async () => {
        const results = await table.where(not(inArray('status', ['active', 'pending']))).all()
        expect(results).toHaveLength(3) // Charlie, Frank, Grace
        expect(results.every((r: TestRecord) => !['active', 'pending'].includes(r.status))).toBe(true)
      })
    })
  })

  describe('Composable Operations', () => {
    describe('not(inArray(...)) vs notIn', () => {
      it('should produce identical results', async () => {
        const statusList = ['active', 'pending']
        
        const notInResults = await table.where(notIn('status', statusList)).all()
        const composedResults = await table.where(not(inArray('status', statusList))).all()
        
        expect(composedResults).toHaveLength(notInResults.length)
        expect(composedResults.map((r: TestRecord) => r.id).sort()).toEqual(
          notInResults.map((r: TestRecord) => r.id).sort()
        )
      })

      it('should work with complex nested conditions', async () => {
        const values = [25, 30, 35]
        
        const notInResults = await table.where(and(
          eq('isActive', true),
          notIn('age', values)
        )).all()
        
        const composedResults = await table.where(and(
          eq('isActive', true),
          not(inArray('age', values))
        )).all()
        
        expect(composedResults).toHaveLength(notInResults.length)
        expect(composedResults.map((r: TestRecord) => r.id).sort()).toEqual(
          notInResults.map((r: TestRecord) => r.id).sort()
        )
      })
    })

    describe('Complex nested conditions', () => {
      it('should handle deeply nested AND/OR combinations', async () => {
        const results = await table.where(
          or(
            and(
              eq('isActive', true),
              inArray('category', ['A', 'B'])
            ),
            and(
              eq('status', 'banned'),
              gt('score', 85)
            )
          )
        ).all()
        
        // Active users in category A or B, OR banned users with score > 85
        expect(results).toHaveLength(3) // Alice (active, A), Bob (active, B), and Grace (banned, 90)
      })

      it('should handle NOT with nested conditions', async () => {
        const results = await table.where(
          not(
            or(
              eq('status', 'active'),
              eq('status', 'pending')
            )
          )
        ).all()
        
        expect(results).toHaveLength(3) // Charlie, Frank, Grace (not active or pending)
        expect(results.every((r: TestRecord) => 
          r.status !== 'active' && r.status !== 'pending'
        )).toBe(true)
      })
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    it('should handle undefined/null field values in comparisons', async () => {
      // Test with records that have null category
      const results = await table.where(eq('category', null)).all()
      expect(results).toHaveLength(1)
      expect(results[0].category).toBeNull()
    })

    it('should handle empty arrays in inArray', async () => {
      const results = await table.where(inArray('status', [])).all()
      expect(results).toHaveLength(0)
    })

    it('should handle empty arrays in notIn', async () => {
      const results = await table.where(notIn('status', [])).all()
      expect(results).toHaveLength(7) // All records
    })

    it('should handle mixed type arrays in inArray', async () => {
      // This tests the robustness of the includes() operation
      const results = await table.where(inArray('name', ['Alice', 123, true, null])).all()
      expect(results).toHaveLength(1) // Only Alice matches
      expect(results[0].name).toBe('Alice')
    })

    it('should handle single-element arrays', async () => {
      const inResults = await table.where(inArray('name', ['Alice'])).all()
      const eqResults = await table.where(eq('name', 'Alice')).all()
      
      expect(inResults).toHaveLength(eqResults.length)
      expect(inResults[0].id).toBe(eqResults[0].id)
    })

    it('should handle boundary conditions in between', async () => {
      // Test exactly on boundaries
      const results = await table.where(between('age', 25, 25)).all()
      expect(results).toHaveLength(1) // Only Alice with age 25
      expect(results[0].name).toBe('Alice')
    })

    it('should handle empty logical operator conditions', async () => {
      // Test with empty condition arrays - this should be handled gracefully
      const results = await table.where(and()).all()
      // The behavior here depends on implementation - might return all or none
      // At minimum, it shouldn't crash
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Type Safety and Field Validation', () => {
    it('should work with different field types', async () => {
      // String fields
      const stringResults = await table.where(eq('name', 'Alice')).all()
      expect(stringResults).toHaveLength(1)

      // Number fields
      const numberResults = await table.where(gt('age', 30)).all()
      expect(numberResults.length).toBeGreaterThan(0)

      // Boolean fields
      const booleanResults = await table.where(eq('isActive', true)).all()
      expect(booleanResults.length).toBeGreaterThan(0)
    })

    it('should handle non-existent fields gracefully', async () => {
      // This tests how the system handles queries on fields that don't exist
      // The behavior might vary, but it shouldn't crash
      const results = await table.where(eq('nonExistentField' as keyof TestRecord, 'value')).all()
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(0) // Likely no matches for non-existent field
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle large arrays in inArray efficiently', async () => {
      // Create a large array of values (most won't match)
      const largeArray = Array.from({ length: 1000 }, (_, i) => `value${i}`)
      largeArray.push('Alice') // Add one matching value
      
      const startTime = Date.now()
      const results = await table.where(inArray('name', largeArray)).all()
      const duration = Date.now() - startTime
      
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Alice')
      // Should complete reasonably quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(1000) // 1 second
    })

    it('should handle complex nested conditions efficiently', async () => {
      const startTime = Date.now()
      const results = await table.where(
        and(
          or(
            and(eq('isActive', true), gt('age', 20)),
            and(eq('isActive', false), lt('age', 40))
          ),
          not(inArray('status', ['banned', 'deleted', 'suspended']))
        )
      ).all()
      const duration = Date.now() - startTime
      
      expect(Array.isArray(results)).toBe(true)
      expect(duration).toBeLessThan(1000) // Should be fast
    })
  })
})