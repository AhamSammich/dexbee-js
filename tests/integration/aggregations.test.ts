import { describe, expect, test, beforeEach } from 'vitest';
import { DexBee } from '../../src/index.js';
import { DatabaseSchema } from '../../src/types/schema.js';
import { eq, gt, lt } from '../../src/query/operators.js';

// Test schema for aggregations
const aggregationSchema: DatabaseSchema = {
  version: 1,
  tables: {
    employees: {
      schema: {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        department: { type: 'string', required: true },
        salary: { type: 'number', required: true },
        age: { type: 'number', required: true },
        isActive: { type: 'boolean', default: () => true },
        score: { type: 'number' }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'department_idx', keyPath: 'department' },
        { name: 'salary_idx', keyPath: 'salary' }
      ]
    },
    sales: {
      schema: {
        id: { type: 'number', required: true },
        employeeId: { type: 'number', required: true },
        amount: { type: 'number', required: true },
        quarter: { type: 'string', required: true },
        year: { type: 'number', required: true }
      },
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'employeeId_idx', keyPath: 'employeeId' },
        { name: 'quarter_idx', keyPath: 'quarter' }
      ]
    }
  }
};

// Type definitions
interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
  age: number;
  isActive: boolean;
  score: number;
}

interface Sale {
  id: number;
  employeeId: number;
  amount: number;
  quarter: string;
  year: number;
}

describe('Aggregations', () => {
  let db: Awaited<ReturnType<typeof DexBee.connect>>;

  beforeEach(async () => {
    // Create and connect to database
    db = await DexBee.connect('test-aggregations-db', aggregationSchema);

    // Set up test data
    await setupTestData();
  });

  async function setupTestData() {
    const employees = db.table<Employee>('employees');
    const sales = db.table<Sale>('sales');

    // Create employees
    await employees.insertMany([
      { name: 'Alice', department: 'Engineering', salary: 80000, age: 30, score: 95 },
      { name: 'Bob', department: 'Engineering', salary: 75000, age: 28, score: 88 },
      { name: 'Charlie', department: 'Engineering', salary: 90000, age: 35, score: 92 },
      { name: 'David', department: 'Sales', salary: 60000, age: 32, score: 85 },
      { name: 'Eve', department: 'Sales', salary: 65000, age: 29, score: 78 },
      { name: 'Frank', department: 'Marketing', salary: 55000, age: 26, score: 82 },
      { name: 'Grace', department: 'Marketing', salary: 58000, age: 31, score: 90 },
      { name: 'Henry', department: 'HR', salary: 70000, age: 40, score: 88 }
    ]);

    // Create sales data
    await sales.insertMany([
      { employeeId: 4, amount: 15000, quarter: 'Q1', year: 2023 }, // David
      { employeeId: 4, amount: 18000, quarter: 'Q2', year: 2023 },
      { employeeId: 5, amount: 12000, quarter: 'Q1', year: 2023 }, // Eve
      { employeeId: 5, amount: 14000, quarter: 'Q2', year: 2023 },
      { employeeId: 4, amount: 20000, quarter: 'Q1', year: 2024 }, // David
      { employeeId: 5, amount: 16000, quarter: 'Q1', year: 2024 }, // Eve
    ]);
  }

  describe('Simple Aggregations', () => {
    test('should calculate count of all employees', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees.count();

      expect(result).toBe(8);
    });

    test('should calculate sum of salaries', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees.sum('salary');

      expect(result).toEqual({
        value: 553000, // Sum of all salaries
        count: 8
      });
    });

    test('should calculate average salary', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees.avg('salary');

      expect(result).toEqual({
        value: 69125, // 553000 / 8
        count: 8
      });
    });

    test('should calculate maximum salary', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees.max('salary');

      expect(result).toEqual({
        value: 90000, // Charlie's salary
        count: 8
      });
    });

    test('should calculate minimum salary', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees.min('salary');

      expect(result).toEqual({
        value: 55000, // Frank's salary
        count: 8
      });
    });

    test('should handle aggregations with no numeric values', async () => {
      const employees = db.table<Employee>('employees');

      // Create a temporary table with no records
      await db.withWriteTransaction(['employees'], async (tx) => {
        const store = tx.getStore('employees');
        const request = store.clear();
        await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      });

      const result = await employees.sum('salary');

      expect(result).toEqual({
        value: 0,
        count: 0
      });
    });
  });

  describe('Aggregations with WHERE clauses', () => {
    test('should calculate sum of salaries for Engineering department', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .where(eq('department', 'Engineering'))
        .sum('salary');

      expect(result).toEqual({
        value: 245000, // Alice: 80000 + Bob: 75000 + Charlie: 90000
        count: 3
      });
    });

    test('should calculate average age for employees over 30', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .where(gt('age', 30))
        .avg('age');

      // Charlie: 35, David: 32, Grace: 31, Henry: 40
      expect(result).toEqual({
        value: 34.5, // (35 + 32 + 31 + 40) / 4
        count: 4
      });
    });

    test('should calculate max score for Sales department', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .where(eq('department', 'Sales'))
        .max('score');

      expect(result).toEqual({
        value: 85, // David's score
        count: 2
      });
    });
  });

  describe('Group By Aggregations', () => {
    test('should group by department and calculate average salary', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .groupBy('department')
        .avg('salary');

      expect('groups' in result).toBe(true);
      if ('groups' in result) {
        expect(result.totalCount).toBe(8);
        expect(result.groups).toHaveLength(4);

        // Find specific departments
        const engineering = result.groups.find(g => g.key.department === 'Engineering');
        const sales = result.groups.find(g => g.key.department === 'Sales');
        const marketing = result.groups.find(g => g.key.department === 'Marketing');
        const hr = result.groups.find(g => g.key.department === 'HR');

        expect(engineering).toEqual({
          key: { department: 'Engineering' },
          value: 81666.66666666667, // (80000 + 75000 + 90000) / 3
          count: 3
        });

        expect(sales).toEqual({
          key: { department: 'Sales' },
          value: 62500, // (60000 + 65000) / 2
          count: 2
        });

        expect(marketing).toEqual({
          key: { department: 'Marketing' },
          value: 56500, // (55000 + 58000) / 2
          count: 2
        });

        expect(hr).toEqual({
          key: { department: 'HR' },
          value: 70000, // 70000 / 1
          count: 1
        });
      }
    });

    test('should group by department and calculate sum of salaries', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .groupBy('department')
        .sum('salary');

      expect('groups' in result).toBe(true);
      if ('groups' in result) {
        const engineering = result.groups.find(g => g.key.department === 'Engineering');
        expect(engineering).toEqual({
          key: { department: 'Engineering' },
          value: 245000, // 80000 + 75000 + 90000
          count: 3
        });
      }
    });

    test('should group by department and count employees', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .groupBy('department')
        .aggregate('count');

      expect('groups' in result).toBe(true);
      if ('groups' in result) {
        expect(result.groups).toHaveLength(4);

        const engineering = result.groups.find(g => g.key.department === 'Engineering');
        expect(engineering).toEqual({
          key: { department: 'Engineering' },
          value: 3,
          count: 3
        });
      }
    });

    test('should group by multiple fields', async () => {
      const sales = db.table<Sale>('sales');

      const result = await sales
        .groupBy('quarter', 'year')
        .sum('amount');

      expect('groups' in result).toBe(true);
      if ('groups' in result) {
        expect(result.groups).toHaveLength(3); // Q1-2023, Q2-2023, Q1-2024

        const q1_2023 = result.groups.find(g => g.key.quarter === 'Q1' && g.key.year === '2023');
        const q2_2023 = result.groups.find(g => g.key.quarter === 'Q2' && g.key.year === '2023');
        const q1_2024 = result.groups.find(g => g.key.quarter === 'Q1' && g.key.year === '2024');

        expect(q1_2023).toEqual({
          key: { quarter: 'Q1', year: '2023' },
          value: 27000, // David: 15000 + Eve: 12000
          count: 2
        });

        expect(q2_2023).toEqual({
          key: { quarter: 'Q2', year: '2023' },
          value: 32000, // David: 18000 + Eve: 14000
          count: 2
        });

        expect(q1_2024).toEqual({
          key: { quarter: 'Q1', year: '2024' },
          value: 36000, // David: 20000 + Eve: 16000
          count: 2
        });
      }
    });
  });

  describe('Group By with WHERE clauses', () => {
    test('should filter before grouping', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .where(gt('salary', 60000))
        .groupBy('department')
        .avg('salary');

      expect('groups' in result).toBe(true);
      if ('groups' in result) {
        // Should exclude Frank (55000), Grace (58000), and David (60000 - not > 60000)
        const engineering = result.groups.find(g => g.key.department === 'Engineering');
        const sales = result.groups.find(g => g.key.department === 'Sales');
        const hr = result.groups.find(g => g.key.department === 'HR');

        expect(engineering).toEqual({
          key: { department: 'Engineering' },
          value: 81666.66666666667, // All 3 engineering employees qualify
          count: 3
        });

        expect(sales).toEqual({
          key: { department: 'Sales' },
          value: 65000, // Only Eve qualifies (65000 > 60000)
          count: 1
        });

        expect(hr).toEqual({
          key: { department: 'HR' },
          value: 70000, // Henry qualifies (70000 > 60000)
          count: 1
        });

        // Marketing should have no employees (both Grace 58000 and Frank 55000 are <= 60000)
        const marketing = result.groups.find(g => g.key.department === 'Marketing');
        expect(marketing).toBeUndefined();
      }
    });
  });

  describe('Complex Aggregation Scenarios', () => {
    test('should handle aggregation with field selection', async () => {
      const employees = db.table<Employee>('employees');

      // This should work - we're aggregating, not selecting fields
      const result = await employees
        .where(eq('department', 'Engineering'))
        .sum('salary');

      expect(result).toEqual({
        value: 245000,
        count: 3
      });
    });

    test('should calculate multiple aggregations sequentially', async () => {
      const employees = db.table<Employee>('employees');

      const sumResult = await employees.where(eq('department', 'Engineering')).sum('salary');
      const avgResult = await employees.where(eq('department', 'Engineering')).avg('salary');
      const countResult = await employees.where(eq('department', 'Engineering')).count();

      expect(sumResult.value).toBe(245000);
      expect(avgResult.value).toBeCloseTo(81666.67, 1);
      expect(countResult).toBe(3);
    });

    test('should handle empty groups gracefully', async () => {
      const employees = db.table<Employee>('employees');

      const result = await employees
        .where(eq('department', 'NonExistent'))
        .groupBy('department')
        .sum('salary');

      expect('groups' in result).toBe(true);
      if ('groups' in result) {
        expect(result.groups).toHaveLength(0);
        expect(result.totalCount).toBe(0);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined values in aggregation field', async () => {
      const employees = db.table<Employee>('employees');

      // Insert employee with undefined score
      await employees.insert({
        name: 'Test',
        department: 'Test',
        salary: 50000,
        age: 25,
        score: undefined as any
      });

      const result = await employees.avg('score');

      // Should only count employees with valid scores
      expect(result.count).toBe(8); // Original 8 employees, new one excluded
    });

    test('should handle aggregation on empty table', async () => {
      // Clear all employees
      await db.withWriteTransaction(['employees'], async (tx) => {
        const store = tx.getStore('employees');
        const request = store.clear();
        await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      });

      const employees = db.table<Employee>('employees');
      const result = await employees.sum('salary');

      expect(result).toEqual({
        value: 0,
        count: 0
      });
    });

    test('should validate required field for aggregation functions', async () => {
      const employees = db.table<Employee>('employees');

      // This should work for count (no field required)
      const countResult = await employees.aggregate('count');
      expect(countResult.count).toBe(8);

      // This should require a field for sum
      await expect(employees.aggregate('sum')).rejects.toThrow('Field is required for sum aggregation');
    });
  });
});