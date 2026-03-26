import type { HistoryItem } from '../api/types'

const STORAGE_KEY = 'analysisHistory'
const DB_NAME = 'vision-agent-analyst'
const STORE_NAME = 'analysisHistory'
const DB_VERSION = 1
const LOCAL_STORAGE_MAX_ITEMS = 50
const LOCAL_STORAGE_MAX_ANALYSIS_LENGTH = 4000

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function compactHistoryItem(item: HistoryItem): HistoryItem {
  return {
    ...item,
    analysis: item.analysis.length > LOCAL_STORAGE_MAX_ANALYSIS_LENGTH
      ? `${item.analysis.slice(0, LOCAL_STORAGE_MAX_ANALYSIS_LENGTH)}\n\n[truncated in browser fallback storage]`
      : item.analysis,
  }
}

function loadLocalHistory(): HistoryItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as HistoryItem[] : []
  } catch {
    return []
  }
}

function persistLocalHistory(items: HistoryItem[]): void {
  let nextItems = items.map(compactHistoryItem).slice(0, LOCAL_STORAGE_MAX_ITEMS)

  while (nextItems.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems))
      return
    } catch {
      nextItems = nextItems.slice(0, Math.max(1, nextItems.length - 5))
    }
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore final fallback failures.
  }
}

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readAllFromDb(db: IDBDatabase): Promise<HistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const items = (request.result as HistoryItem[]).sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id)
      )
      resolve(items)
    }
    request.onerror = () => reject(request.error)
  })
}

function putItemInDb(db: IDBDatabase, item: HistoryItem): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.objectStore(STORE_NAME).put(item)
  })
}

function clearDb(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.objectStore(STORE_NAME).clear()
  })
}

async function migrateLocalStorageToDb(db: IDBDatabase): Promise<void> {
  const localItems = loadLocalHistory()
  if (localItems.length === 0) {
    return
  }

  for (const item of localItems) {
    await putItemInDb(db, item)
  }

  localStorage.removeItem(STORAGE_KEY)
}

export async function loadHistoryItems(): Promise<HistoryItem[]> {
  if (!canUseIndexedDb()) {
    return loadLocalHistory()
  }

  try {
    const db = await openHistoryDb()
    await migrateLocalStorageToDb(db)
    return await readAllFromDb(db)
  } catch {
    return loadLocalHistory()
  }
}

export async function appendHistoryItem(item: HistoryItem): Promise<void> {
  if (!canUseIndexedDb()) {
    persistLocalHistory([item, ...loadLocalHistory()])
    return
  }

  try {
    const db = await openHistoryDb()
    await putItemInDb(db, item)
  } catch {
    persistLocalHistory([item, ...loadLocalHistory()])
  }
}

export async function clearHistoryItems(): Promise<void> {
  if (!canUseIndexedDb()) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }

  try {
    const db = await openHistoryDb()
    await clearDb(db)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}