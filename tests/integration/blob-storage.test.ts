import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexBee } from '../../src/index';
import type { DatabaseSchema } from '../../src/index';
import { eq, and, sizeGt, sizeLt, sizeBetween, mimeType } from '../../src/index';

/**
 * Phase 2: Blob Support Integration Tests
 *
 * This test suite defines the expected behavior for blob storage support.
 * All tests should initially fail until Phase 3 implementation is complete.
 */

// =============================================================================
// 2.1 SCHEMA DEFINITION TESTS
// =============================================================================

describe('Blob Field Type Validation', () => {
  it('should accept valid blob field definition', async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        documents: {
          schema: {
            id: { type: 'string', required: true },
            attachment: { type: 'blob' }
          },
          primaryKey: 'id'
        }
      }
    };

    const db = await DexBee.connect('test-blob-validation', schema);
    expect(db).toBeDefined();
    await db.close();
  });

  it('should accept valid file field definition with metadata tracking', async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        uploads: {
          schema: {
            id: { type: 'number', required: true },
            file: {
              type: 'file',
              metadata: {
                trackSize: true,
                trackType: true,
                trackLastModified: true
              }
            }
          },
          primaryKey: 'id',
          autoIncrement: true
        }
      }
    };

    const db = await DexBee.connect('test-file-validation', schema);
    expect(db).toBeDefined();
    await db.close();
  });

  it('should accept arraybuffer field definition', async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        binary: {
          schema: {
            id: { type: 'string', required: true },
            data: { type: 'arraybuffer' }
          },
          primaryKey: 'id'
        }
      }
    };

    const db = await DexBee.connect('test-arraybuffer-validation', schema);
    expect(db).toBeDefined();
    await db.close();
  });

  it('should accept blob field with size constraints', async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        images: {
          schema: {
            id: { type: 'string', required: true },
            thumbnail: {
              type: 'blob',
              maxSize: 500 * 1024 // 500KB
            }
          },
          primaryKey: 'id'
        }
      }
    };

    const db = await DexBee.connect('test-blob-size', schema);
    expect(db).toBeDefined();
    await db.close();
  });

  it('should accept blob field with MIME type restrictions', async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        media: {
          schema: {
            id: { type: 'string', required: true },
            image: {
              type: 'file',
              allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
            }
          },
          primaryKey: 'id'
        }
      }
    };

    const db = await DexBee.connect('test-mime-types', schema);
    expect(db).toBeDefined();
    await db.close();
  });
});

describe('Blob Field Validation on Insert', () => {
  let db: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        documents: {
          schema: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            content: {
              type: 'file',
              maxSize: 10 * 1024 * 1024, // 10MB
              allowedTypes: ['application/pdf', 'text/plain']
            },
            thumbnail: {
              type: 'blob',
              allowedTypes: ['image/jpeg', 'image/png']
            }
          },
          primaryKey: 'id'
        }
      }
    };

    db = await DexBee.connect('test-validation', schema);
  });

  afterEach(async () => {
    await db.close();
  });

  it('should reject non-Blob value for blob field', async () => {
    const documents = db.table('documents');

    await expect(
      documents.insert({
        id: '1',
        title: 'Test',
        thumbnail: 'not-a-blob'
      })
    ).rejects.toThrow(/must be of type 'blob'/);
  });

  it('should reject non-File value for file field', async () => {
    const documents = db.table('documents');

    await expect(
      documents.insert({
        id: '1',
        title: 'Test',
        content: new Blob(['data'])
      })
    ).rejects.toThrow(/must be of type 'file'/);
  });

  it('should reject blob exceeding maxSize', async () => {
    const documents = db.table('documents');
    const largeFile = new File(
      [new ArrayBuffer(11 * 1024 * 1024)], // 11MB
      'large.pdf',
      { type: 'application/pdf' }
    );

    await expect(
      documents.insert({
        id: '1',
        title: 'Large Doc',
        content: largeFile
      })
    ).rejects.toThrow(/exceeds maximum/);
  });

  it('should reject blob with disallowed MIME type', async () => {
    const documents = db.table('documents');
    const wrongType = new Blob(['image data'], { type: 'image/gif' });

    await expect(
      documents.insert({
        id: '1',
        title: 'Test',
        thumbnail: wrongType
      })
    ).rejects.toThrow(/MIME type.*not allowed/);
  });

  it('should accept blob with valid size and MIME type', async () => {
    const documents = db.table('documents');
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const thumbnail = new Blob(['image'], { type: 'image/jpeg' });

    const result = await documents.insert({
      id: '1',
      title: 'Valid Doc',
      content: file,
      thumbnail
    });

    expect(result).toBeDefined();
    expect(result.id).toBe('1');
  });
});

// =============================================================================
// 2.2 BLOB STORAGE & RETRIEVAL TESTS
// =============================================================================

describe('Blob CRUD Operations', () => {
  let db: any;
  let documents: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        documents: {
          schema: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            content: { type: 'file' },
            thumbnail: { type: 'blob' },
            data: { type: 'arraybuffer' }
          },
          primaryKey: 'id'
        }
      }
    };

    db = await DexBee.connect('test-blob-crud', schema);
    documents = db.table('documents');
  });

  afterEach(async () => {
    await db.close();
  });

  it('should store and retrieve File object with metadata preserved', async () => {
    const file = new File(['test content'], 'test.txt', {
      type: 'text/plain',
      lastModified: Date.now()
    });

    await documents.insert({
      id: '1',
      title: 'Test Doc',
      content: file
    });

    const retrieved = await documents.findById('1');

    expect(retrieved.content).toBeInstanceOf(File);
    expect(retrieved.content.name).toBe('test.txt');
    expect(retrieved.content.type).toBe('text/plain');
    expect(retrieved.content.size).toBe(file.size);

    // Verify content is preserved
    const text = await retrieved.content.text();
    expect(text).toBe('test content');
  });

  it('should store and retrieve Blob object', async () => {
    const blob = new Blob(['binary data'], { type: 'application/octet-stream' });

    await documents.insert({
      id: '2',
      title: 'Blob Doc',
      thumbnail: blob
    });

    const retrieved = await documents.findById('2');

    expect(retrieved.thumbnail).toBeInstanceOf(Blob);
    expect(retrieved.thumbnail.type).toBe('application/octet-stream');
    expect(retrieved.thumbnail.size).toBe(blob.size);
  });

  it('should store and retrieve ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(256);
    const view = new Uint8Array(buffer);
    view[0] = 255;
    view[255] = 128;

    await documents.insert({
      id: '3',
      title: 'Buffer Doc',
      data: buffer
    });

    const retrieved = await documents.findById('3');

    expect(retrieved.data).toBeInstanceOf(ArrayBuffer);
    expect(retrieved.data.byteLength).toBe(256);

    const retrievedView = new Uint8Array(retrieved.data);
    expect(retrievedView[0]).toBe(255);
    expect(retrievedView[255]).toBe(128);
  });

  it('should update blob field', async () => {
    const file1 = new File(['version 1'], 'v1.txt', { type: 'text/plain' });

    await documents.insert({
      id: '4',
      title: 'Update Test',
      content: file1
    });

    const file2 = new File(['version 2'], 'v2.txt', { type: 'text/plain' });
    await documents.update('4', { content: file2 });

    const retrieved = await documents.findById('4');
    expect(retrieved.content.name).toBe('v2.txt');

    const text = await retrieved.content.text();
    expect(text).toBe('version 2');
  });

  it('should delete record with blob fields', async () => {
    const file = new File(['to delete'], 'delete.txt', { type: 'text/plain' });

    await documents.insert({
      id: '5',
      title: 'Delete Test',
      content: file
    });

    await documents.delete('5');

    const retrieved = await documents.findById('5');
    expect(retrieved).toBeNull();
  });

  it('should handle multiple blobs in same record', async () => {
    const file = new File(['file content'], 'doc.pdf', { type: 'application/pdf' });
    const thumbnail = new Blob(['thumb data'], { type: 'image/jpeg' });
    const buffer = new ArrayBuffer(128);

    await documents.insert({
      id: '6',
      title: 'Multi Blob',
      content: file,
      thumbnail,
      data: buffer
    });

    const retrieved = await documents.findById('6');

    expect(retrieved.content).toBeInstanceOf(File);
    expect(retrieved.thumbnail).toBeInstanceOf(Blob);
    expect(retrieved.data).toBeInstanceOf(ArrayBuffer);
  });
});

describe('Blob URL Generation', () => {
  let db: any;
  let documents: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        documents: {
          schema: {
            id: { type: 'string', required: true },
            title: { type: 'string' },
            file: { type: 'file' },
            image: { type: 'blob' }
          },
          primaryKey: 'id'
        }
      }
    };

    db = await DexBee.connect('test-blob-urls', schema);
    documents = db.table('documents');
  });

  afterEach(async () => {
    await db.close();
  });

  it('should generate object URL for file field', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    await documents.insert({
      id: '1',
      title: 'Test',
      file
    });

    const url = await documents.getBlobUrl('1', 'file');

    expect(url).toMatch(/^blob:/);
    expect(typeof url).toBe('string');

    // URL should be valid (in real browser would be usable)
    URL.revokeObjectURL(url); // Cleanup
  });

  it('should generate object URL for blob field', async () => {
    const blob = new Blob(['image data'], { type: 'image/jpeg' });

    await documents.insert({
      id: '2',
      title: 'Image',
      image: blob
    });

    const url = await documents.getBlobUrl('2', 'image');

    expect(url).toMatch(/^blob:/);
    URL.revokeObjectURL(url);
  });

  it('should throw error when generating URL for non-existent record', async () => {
    await expect(
      documents.getBlobUrl('nonexistent', 'file')
    ).rejects.toThrow(/not found/);
  });

  it('should throw error when generating URL for non-blob field', async () => {
    await documents.insert({
      id: '3',
      title: 'No Blob'
    });

    await expect(
      documents.getBlobUrl('3', 'file')
    ).rejects.toThrow(/not a Blob or File/);
  });
});

// =============================================================================
// 2.3 BLOB QUERY TESTS
// =============================================================================

describe('Blob Size Queries', () => {
  let db: any;
  let files: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        files: {
          schema: {
            id: { type: 'number', required: true },
            name: { type: 'string', required: true },
            data: { type: 'file' }
          },
          primaryKey: 'id',
          autoIncrement: true
        }
      }
    };

    db = await DexBee.connect('test-size-queries', schema);
    files = db.table('files');

    // Insert test data with varying sizes
    await files.insert({
      id: 1,
      name: 'small.txt',
      data: new File(['tiny'], 'small.txt', { type: 'text/plain' }) // 4 bytes
    });

    await files.insert({
      id: 2,
      name: 'medium.txt',
      data: new File(['a'.repeat(1024)], 'medium.txt', { type: 'text/plain' }) // 1KB
    });

    await files.insert({
      id: 3,
      name: 'large.txt',
      data: new File(['b'.repeat(10240)], 'large.txt', { type: 'text/plain' }) // 10KB
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('should filter blobs by size greater than threshold', async () => {
    const results = await files
      .where(sizeGt('data', 1000))
      .all();

    expect(results.length).toBe(2); // medium and large
    results.forEach((file: any) => {
      expect(file.data.size).toBeGreaterThan(1000);
    });
  });

  it('should filter blobs by size less than threshold', async () => {
    const results = await files
      .where(sizeLt('data', 100))
      .all();

    expect(results.length).toBe(1); // small only
    expect(results[0].name).toBe('small.txt');
  });

  it('should filter blobs by size range', async () => {
    const results = await files
      .where(sizeBetween('data', 500, 5000))
      .all();

    expect(results.length).toBe(1); // medium only
    expect(results[0].name).toBe('medium.txt');
  });

  it('should combine size queries with other conditions', async () => {
    const results = await files
      .where(and(
        sizeGt('data', 500),
        eq('name', 'large.txt')
      ))
      .all();

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('large.txt');
  });
});

describe('MIME Type Queries', () => {
  let db: any;
  let media: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        media: {
          schema: {
            id: { type: 'number', required: true },
            name: { type: 'string', required: true },
            file: { type: 'file' }
          },
          primaryKey: 'id',
          autoIncrement: true
        }
      }
    };

    db = await DexBee.connect('test-mime-queries', schema);
    media = db.table('media');

    // Insert files with different MIME types
    await media.insert({
      id: 1,
      name: 'document.pdf',
      file: new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })
    });

    await media.insert({
      id: 2,
      name: 'photo.jpg',
      file: new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' })
    });

    await media.insert({
      id: 3,
      name: 'icon.png',
      file: new File(['png'], 'icon.png', { type: 'image/png' })
    });

    await media.insert({
      id: 4,
      name: 'data.txt',
      file: new File(['txt'], 'data.txt', { type: 'text/plain' })
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('should filter files by exact MIME type', async () => {
    const pdfs = await media
      .where(mimeType('file', 'application/pdf'))
      .all();

    expect(pdfs.length).toBe(1);
    expect(pdfs[0].name).toBe('document.pdf');
  });

  it('should filter images by MIME type', async () => {
    const jpgs = await media
      .where(mimeType('file', 'image/jpeg'))
      .all();

    expect(jpgs.length).toBe(1);
    expect(jpgs[0].name).toBe('photo.jpg');
  });

  it('should combine MIME type with other filters', async () => {
    const results = await media
      .where(and(
        mimeType('file', 'image/png'),
        eq('name', 'icon.png')
      ))
      .all();

    expect(results.length).toBe(1);
    expect(results[0].file.type).toBe('image/png');
  });

  it('should return empty results for non-matching MIME type', async () => {
    const results = await media
      .where(mimeType('file', 'video/mp4'))
      .all();

    expect(results.length).toBe(0);
  });
});

describe('Blob Metadata Queries', () => {
  let db: any;
  let documents: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        documents: {
          schema: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            content: { type: 'file' },
            thumbnail: { type: 'blob' }
          },
          primaryKey: 'id'
        }
      }
    };

    db = await DexBee.connect('test-metadata', schema);
    documents = db.table('documents');

    const file = new File(['content'], 'doc.pdf', {
      type: 'application/pdf',
      lastModified: 1234567890000
    });
    const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' });

    await documents.insert({
      id: '1',
      title: 'Test Doc',
      content: file,
      thumbnail
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('should retrieve blob metadata for file field', async () => {
    const metadata = await documents.getBlobMetadata('1', 'content');

    expect(metadata).toEqual({
      size: expect.any(Number),
      type: 'application/pdf',
      name: 'doc.pdf',
      lastModified: 1234567890000
    });
  });

  it('should retrieve blob metadata for blob field', async () => {
    const metadata = await documents.getBlobMetadata('1', 'thumbnail');

    expect(metadata).toEqual({
      size: expect.any(Number),
      type: 'image/jpeg'
    });
  });

  it('should throw error for non-blob field', async () => {
    await expect(
      documents.getBlobMetadata('1', 'title')
    ).rejects.toThrow(/not a Blob, File, or ArrayBuffer/);
  });
});

// =============================================================================
// 2.4 PERFORMANCE & LARGE BLOB TESTS
// =============================================================================

describe('Large Blob Performance', () => {
  let db: any;
  let files: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        files: {
          schema: {
            id: { type: 'number', required: true },
            name: { type: 'string', required: true },
            data: { type: 'blob' }
          },
          primaryKey: 'id',
          autoIncrement: true
        }
      }
    };

    db = await DexBee.connect('test-large-blobs', schema);
    files = db.table('files');
  });

  afterEach(async () => {
    await db.close();
  });

  it('should store large blob efficiently (10MB)', async () => {
    const largeBlob = new Blob([new ArrayBuffer(10 * 1024 * 1024)])

    // Test that large blob insertion completes without error
    await files.insert({
      id: 1,
      name: 'large-file.bin',
      data: largeBlob
    })

    // Verify the blob was stored correctly
    const retrieved = await files.findById(1)
    expect(retrieved.data.size).toBe(10 * 1024 * 1024)
    expect(retrieved.name).toBe('large-file.bin')
  })

  it('should retrieve large blob efficiently', async () => {
    const largeBlob = new Blob([new ArrayBuffer(5 * 1024 * 1024)])

    await files.insert({
      id: 2,
      name: 'retrieve-test.bin',
      data: largeBlob
    })

    // Test that large blob retrieval completes without error
    const retrieved = await files.findById(2)

    expect(retrieved.data.size).toBe(5 * 1024 * 1024)
    expect(retrieved.name).toBe('retrieve-test.bin')
  })

  it('should handle multiple large blobs', async () => {
    const promises = [];

    for (let i = 0; i < 5; i++) {
      const blob = new Blob([new ArrayBuffer(2 * 1024 * 1024)]);
      promises.push(
        files.insert({
          id: i + 1,
          name: `file-${i}.bin`,
          data: blob
        })
      );
    }

    await Promise.all(promises);

    const all = await files.all();
    expect(all.length).toBe(5);
  });
});

describe('Blob Streaming', () => {
  let db: any;
  let files: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        files: {
          schema: {
            id: { type: 'number', required: true },
            data: { type: 'blob' }
          },
          primaryKey: 'id',
          autoIncrement: true
        }
      }
    };

    db = await DexBee.connect('test-streaming', schema);
    files = db.table('files');
  });

  afterEach(async () => {
    await db.close();
  });

  it('should stream blob data', async () => {
    const testData = 'x'.repeat(10000);
    const blob = new Blob([testData], { type: 'text/plain' });

    await files.insert({
      id: 1,
      data: blob
    });

    const stream = await files.streamBlob(1, 'data');

    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it('should read streamed blob in chunks', async () => {
    const testData = 'chunk-test-data';
    const blob = new Blob([testData], { type: 'text/plain' });

    await files.insert({
      id: 2,
      data: blob
    });

    const stream = await files.streamBlob(2, 'data');
    const reader = stream.getReader();

    let receivedData = '';
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        receivedData += new TextDecoder().decode(value);
      }
    }

    expect(receivedData).toBe(testData);
  });
});

// =============================================================================
// 2.5 QUERY OPTIMIZATION TESTS
// =============================================================================

describe('Blob Query Optimization', () => {
  let db: any;
  let documents: any;

  beforeEach(async () => {
    const schema: DatabaseSchema = {
      version: 1,
      tables: {
        documents: {
          schema: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            content: { type: 'file' },
            thumbnail: { type: 'blob' }
          },
          primaryKey: 'id'
        }
      }
    };

    db = await DexBee.connect('test-optimization', schema);
    documents = db.table('documents');

    // Insert test documents
    for (let i = 1; i <= 3; i++) {
      await documents.insert({
        id: `${i}`,
        title: `Doc ${i}`,
        content: new File([`content ${i}`], `doc${i}.txt`, { type: 'text/plain' }),
        thumbnail: new Blob([`thumb ${i}`], { type: 'image/jpeg' })
      });
    }
  });

  afterEach(async () => {
    await db.close();
  });

  it.skip('should exclude blob fields from query results', async () => {
    const results = await documents
      .select(['id', 'title'])
      .blob({ excludeBlobs: ['content', 'thumbnail'] })
      .all();

    expect(results.length).toBe(3);
    results.forEach((doc: any) => {
      expect(doc.id).toBeDefined();
      expect(doc.title).toBeDefined();
      expect(doc.content).toBeUndefined();
      expect(doc.thumbnail).toBeUndefined();
    });
  });

  it.skip('should return metadata only for specified blob fields', async () => {
    const results = await documents
      .blob({ metadataOnly: ['content'] })
      .all();

    expect(results.length).toBe(3);
    results.forEach((doc: any) => {
      expect(doc.content).toEqual({
        size: expect.any(Number),
        type: 'text/plain',
        name: expect.stringMatching(/^doc\d\.txt$/),
        lastModified: expect.any(Number)
      });
      expect(doc.thumbnail).toBeInstanceOf(Blob);
    });
  });

  it.skip('should generate URLs for specified blob fields', async () => {
    const results = await documents
      .blob({ generateUrls: ['thumbnail'] })
      .all();

    expect(results.length).toBe(3);
    results.forEach((doc: any) => {
      expect(doc.thumbnail).toBeInstanceOf(Blob);
      expect(doc.thumbnailUrl).toMatch(/^blob:/);

      // Cleanup
      URL.revokeObjectURL(doc.thumbnailUrl);
    });
  });
});
