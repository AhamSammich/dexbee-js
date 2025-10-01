import { describe, expect, it } from 'vitest'

/**
 * Simple test to verify fake-indexeddb handles Blob/File/ArrayBuffer
 */
describe('fake-indexeddb Blob Support', () => {
  it('should serialize and deserialize Blob using structuredClone', () => {
    const blob = new Blob(['test content'], { type: 'text/plain' })
    const cloned = structuredClone(blob)

    console.log('Original blob:', blob)
    console.log('Cloned blob:', cloned)
    console.log('Is Blob?:', cloned instanceof Blob)
    console.log('Size:', cloned.size)
    console.log('Type:', cloned.type)

    expect(cloned).toBeInstanceOf(Blob)
    expect(cloned.size).toBe(blob.size)
    expect(cloned.type).toBe(blob.type)
  })

  it('should serialize and deserialize File using structuredClone', () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const cloned = structuredClone(file)

    console.log('Original file:', file)
    console.log('Cloned file:', cloned)
    console.log('Is File?:', cloned instanceof File)

    expect(cloned).toBeInstanceOf(File)
    expect(cloned.name).toBe(file.name)
    expect(cloned.size).toBe(file.size)
  })

  it('should serialize and deserialize ArrayBuffer using structuredClone', () => {
    const buffer = new ArrayBuffer(256)
    const view = new Uint8Array(buffer)
    view[0] = 42

    const cloned = structuredClone(buffer)
    const clonedView = new Uint8Array(cloned)

    console.log('Original buffer:', buffer)
    console.log('Cloned buffer:', cloned)
    console.log('Is ArrayBuffer?:', cloned instanceof ArrayBuffer)

    expect(cloned).toBeInstanceOf(ArrayBuffer)
    expect(cloned.byteLength).toBe(buffer.byteLength)
    expect(clonedView[0]).toBe(42)
  })

  it('should store and retrieve Blob directly with fake-indexeddb', async () => {
    const dbName = `blob-test-${Date.now()}`

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)

      request.onerror = () => reject(request.error)

      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('test', { keyPath: 'id' })
      }

      request.onsuccess = () => {
        const db = request.result
        const blob = new Blob(['test content'], { type: 'text/plain' })

        // Store
        const tx = db.transaction('test', 'readwrite')
        const store = tx.objectStore('test')
        const putRequest = store.put({ id: 1, data: blob })

        putRequest.onsuccess = () => {
          // Retrieve
          const getTx = db.transaction('test', 'readonly')
          const getStore = getTx.objectStore('test')
          const getRequest = getStore.get(1)

          getRequest.onsuccess = () => {
            const record = getRequest.result
            console.log('Retrieved record:', record)
            console.log('Retrieved data:', record.data)
            console.log('Is Blob?:', record.data instanceof Blob)
            console.log('Data type:', typeof record.data)
            console.log('Data constructor:', record.data?.constructor?.name)

            db.close()

            try {
              expect(record.data).toBeInstanceOf(Blob)
              resolve()
            } catch (err) {
              reject(err)
            }
          }

          getRequest.onerror = () => reject(getRequest.error)
        }

        putRequest.onerror = () => reject(putRequest.error)
      }
    })
  })
})
