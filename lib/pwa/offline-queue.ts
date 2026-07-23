'use client'

/**
 * Offline action queue (IndexedDB-backed).
 * ─────────────────────────────────────────────────────────────
 * Queues Approve / Reject approval decisions made while offline and
 * replays them against the server when connectivity returns.
 *
 * Storage: IndexedDB (survives reload / app relaunch, unlike memory).
 * Flush:   call `flushQueue(handler)` on reconnect. The handler runs
 *          the real server action for each queued item; successfully
 *          synced items are removed, failures are kept for retry.
 */

export interface QueuedApproval {
  /** Client-generated id for the queue entry. */
  id: string
  /** The approval record id on the server. */
  approvalId: string
  /** Human-readable code for toasts (e.g. "PO-2026-001"). */
  objectCode: string
  decision: 'approved' | 'rejected'
  comment: string
  queuedAt: number
}

const DB_NAME = 'gmc-offline'
const DB_VERSION = 1
const STORE = 'approval-queue'

// ── IndexedDB plumbing ───────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

// ── Public API ───────────────────────────────────────────────

/** Add a decision to the offline queue. */
export async function enqueueApproval(item: Omit<QueuedApproval, 'id' | 'queuedAt'>): Promise<QueuedApproval> {
  const entry: QueuedApproval = {
    ...item,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  }
  try {
    await tx('readwrite', (store) => store.put(entry))
  } catch {
    // IndexedDB unavailable (private mode etc.) — fall back to localStorage.
    const list = readLsQueue()
    list.push(entry)
    writeLsQueue(list)
  }
  return entry
}

/** Read all queued items (oldest first). */
export async function getQueue(): Promise<QueuedApproval[]> {
  try {
    const all = await tx<QueuedApproval[]>('readonly', (store) => store.getAll() as IDBRequest<QueuedApproval[]>)
    return (all ?? []).sort((a, b) => a.queuedAt - b.queuedAt)
  } catch {
    return readLsQueue().sort((a, b) => a.queuedAt - b.queuedAt)
  }
}

/** How many decisions are pending sync. */
export async function getQueueCount(): Promise<number> {
  return (await getQueue()).length
}

async function removeFromQueue(id: string): Promise<void> {
  try {
    await tx('readwrite', (store) => store.delete(id))
  } catch {
    writeLsQueue(readLsQueue().filter((e) => e.id !== id))
  }
}

/**
 * Flush the queue. For each item, `handler` runs the real server action.
 * Returns the items that synced successfully. Failed items stay queued.
 */
export async function flushQueue(
  handler: (item: QueuedApproval) => Promise<{ error: string | null }>,
): Promise<{ synced: QueuedApproval[]; failed: QueuedApproval[] }> {
  const queue = await getQueue()
  const synced: QueuedApproval[] = []
  const failed: QueuedApproval[] = []

  for (const item of queue) {
    try {
      const res = await handler(item)
      if (res.error) {
        failed.push(item)
      } else {
        await removeFromQueue(item.id)
        synced.push(item)
      }
    } catch {
      failed.push(item)
    }
  }

  return { synced, failed }
}

// ── localStorage fallback (for environments without IndexedDB) ─
const LS_KEY = 'gmc-offline-queue'

function readLsQueue(): QueuedApproval[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLsQueue(list: QueuedApproval[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
