// Persists the working project so a reload doesn't lose it: the edit doc (small
// JSON — cues, controls, trim, keyframes, image-clip metadata, audio mix) plus the
// raw media blobs (audio/music/images) it references. IndexedDB is used for both
// because media blobs are large and binary; localStorage couldn't hold them.

const DB_NAME = 'ztudio-project'
const VERSION = 1
const BLOBS = 'blobs' // key (string) -> Blob
const META = 'meta' // 'doc' -> project doc object
const DOC_KEY = 'doc'

let dbPromise = null

function openDB() {
  if (dbPromise) {
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BLOBS)) {
        db.createObjectStore(BLOBS)
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(storeName, mode, run) {
  return openDB().then(
    db =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode)
        const result = run(t.objectStore(storeName))
        t.oncomplete = () => resolve(result.value)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export function putBlob(key, blob) {
  return tx(BLOBS, 'readwrite', store => {
    store.put(blob, key)
    return { value: undefined }
  })
}

export function getBlob(key) {
  return tx(BLOBS, 'readonly', store => {
    const result = { value: null }
    store.get(key).onsuccess = e => {
      result.value = e.target.result || null
    }
    return result
  })
}

export function deleteBlob(key) {
  return tx(BLOBS, 'readwrite', store => {
    store.delete(key)
    return { value: undefined }
  })
}

export function allBlobKeys() {
  return tx(BLOBS, 'readonly', store => {
    const result = { value: [] }
    store.getAllKeys().onsuccess = e => {
      result.value = e.target.result || []
    }
    return result
  })
}

export function saveDoc(doc) {
  return tx(META, 'readwrite', store => {
    store.put(doc, DOC_KEY)
    return { value: undefined }
  })
}

export function loadDoc() {
  return tx(META, 'readonly', store => {
    const result = { value: null }
    store.get(DOC_KEY).onsuccess = e => {
      result.value = e.target.result || null
    }
    return result
  })
}

// Wipe the whole saved project (both stores) in one transaction.
export function clearProject() {
  return openDB().then(
    db =>
      new Promise((resolve, reject) => {
        const t = db.transaction([BLOBS, META], 'readwrite')
        t.objectStore(BLOBS).clear()
        t.objectStore(META).clear()
        t.oncomplete = () => resolve()
        t.onerror = () => reject(t.error)
      }),
  )
}
