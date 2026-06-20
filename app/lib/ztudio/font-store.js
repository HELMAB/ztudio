// Persists uploaded custom fonts so they survive reloads.
// Font files are binary and can be several MB each, so we use IndexedDB
// (stores ArrayBuffers directly, large quota) rather than localStorage
// (strings only, ~5MB cap).

const DB_NAME = 'ztudio-fonts'
const STORE = 'fonts'
const VERSION = 1

let dbPromise = null

function openDB() {
  if (dbPromise) {
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(mode, run) {
  return openDB().then(
    db =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const result = run(store)
        t.oncomplete = () => resolve(result.value)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

// Returns [{ id, name, buffer }] in insertion order.
export function getAllFonts() {
  return tx('readonly', store => {
    const result = { value: [] }
    store.getAll().onsuccess = e => {
      result.value = e.target.result || []
    }
    return result
  })
}

// Stores a font and resolves to its generated id.
export function putFont(name, buffer) {
  return tx('readwrite', store => {
    const result = { value: null }
    store.add({ name, buffer }).onsuccess = e => {
      result.value = e.target.result
    }
    return result
  })
}

export function deleteFont(id) {
  return tx('readwrite', store => {
    store.delete(id)
    return { value: undefined }
  })
}

export function clearFonts() {
  return tx('readwrite', store => {
    store.clear()
    return { value: undefined }
  })
}
