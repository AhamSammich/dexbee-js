import type { WhereCondition } from '../../src/types/query.js'
import { describe, expect, it } from 'vitest'
import { mimeType, sizeBetween, sizeGt, sizeLt } from '../../src/query/operators.js'

describe('Blob Operators', () => {
  describe('sizeGt', () => {
    it('should create a blob size greater than condition', () => {
      const condition = sizeGt<{ file: Blob }>('file', 1024)

      expect(condition).toEqual({
        type: 'comparison',
        operator: 'blobSizeGt',
        field: 'file',
        value: 1024,
      })
    })

    it('should accept any numeric size value', () => {
      const condition = sizeGt<{ data: Blob }>('data', 50 * 1024 * 1024) // 50MB

      expect(condition.value).toBe(50 * 1024 * 1024)
    })

    it('should work with different field names', () => {
      const condition = sizeGt<{ thumbnail: Blob, avatar: Blob }>('avatar', 100)

      expect(condition.field).toBe('avatar')
    })
  })

  describe('sizeLt', () => {
    it('should create a blob size less than condition', () => {
      const condition = sizeLt<{ file: Blob }>('file', 5000)

      expect(condition).toEqual({
        type: 'comparison',
        operator: 'blobSizeLt',
        field: 'file',
        value: 5000,
      })
    })

    it('should accept any numeric size value', () => {
      const condition = sizeLt<{ data: Blob }>('data', 10 * 1024) // 10KB

      expect(condition.value).toBe(10 * 1024)
    })

    it('should work with different field names', () => {
      const condition = sizeLt<{ image: Blob, video: Blob }>('video', 1000000)

      expect(condition.field).toBe('video')
    })
  })

  describe('sizeBetween', () => {
    it('should create a blob size between condition', () => {
      const condition = sizeBetween<{ file: Blob }>('file', 1000, 5000)

      expect(condition).toEqual({
        type: 'comparison',
        operator: 'blobSizeBetween',
        field: 'file',
        values: [1000, 5000],
      })
    })

    it('should accept large size ranges', () => {
      const min = 1024 * 1024 // 1MB
      const max = 100 * 1024 * 1024 // 100MB
      const condition = sizeBetween<{ file: Blob }>('file', min, max)

      expect(condition.values).toEqual([min, max])
    })

    it('should work with different field names', () => {
      const condition = sizeBetween<{ document: Blob, attachment: Blob }>('document', 0, 10000)

      expect(condition.field).toBe('document')
      expect(condition.values).toEqual([0, 10000])
    })

    it('should handle min and max values correctly', () => {
      const condition = sizeBetween<{ file: Blob }>('file', 100, 200)

      expect(condition.values?.[0]).toBe(100)
      expect(condition.values?.[1]).toBe(200)
    })
  })

  describe('mimeType', () => {
    it('should create a blob MIME type condition', () => {
      const condition = mimeType<{ file: Blob }>('file', 'image/jpeg')

      expect(condition).toEqual({
        type: 'comparison',
        operator: 'blobMimeType',
        field: 'file',
        value: 'image/jpeg',
      })
    })

    it('should handle various MIME types', () => {
      const types = [
        'image/png',
        'image/jpeg',
        'application/pdf',
        'video/mp4',
        'text/plain',
        'application/octet-stream',
      ]

      types.forEach((type) => {
        const condition = mimeType<{ data: Blob }>('data', type)
        expect(condition.value).toBe(type)
      })
    })

    it('should work with different field names', () => {
      const condition = mimeType<{ thumbnail: Blob, avatar: Blob }>('thumbnail', 'image/png')

      expect(condition.field).toBe('thumbnail')
      expect(condition.value).toBe('image/png')
    })

    it('should handle MIME type with parameters', () => {
      const condition = mimeType<{ file: Blob }>('file', 'text/html; charset=utf-8')

      expect(condition.value).toBe('text/html; charset=utf-8')
    })
  })

  describe('Type Safety', () => {
    it('should maintain type safety with field names', () => {
      interface Document {
        id: number
        content: Blob
        thumbnail: Blob
      }

      const condition1 = sizeGt<Document>('content', 1024)
      const condition2 = mimeType<Document>('thumbnail', 'image/jpeg')

      expect(condition1.field).toBe('content')
      expect(condition2.field).toBe('thumbnail')
    })

    it('should create proper WhereCondition structure', () => {
      const condition: WhereCondition<{ file: Blob }> = sizeGt('file', 1024)

      expect(condition.type).toBe('comparison')
      expect(condition.operator).toBe('blobSizeGt')
      expect(condition.field).toBe('file')
      expect(condition.value).toBe(1024)
    })
  })

  describe('Operator Combinations', () => {
    it('should be compatible with logical operators structure', () => {
      // These operators should be usable with and/or/not operators
      const sizeCondition = sizeGt<{ file: Blob }>('file', 1024)
      const typeCondition = mimeType<{ file: Blob }>('file', 'image/jpeg')

      // Both should have the same base structure
      expect(sizeCondition.type).toBe('comparison')
      expect(typeCondition.type).toBe('comparison')

      // They should be valid WhereCondition objects
      const conditions: WhereCondition<{ file: Blob }>[] = [sizeCondition, typeCondition]
      expect(conditions).toHaveLength(2)
    })
  })
})
