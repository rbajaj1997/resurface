import { EMPTY, reconcile, samePlace, type State } from './cycle'

const STORE = 'state'
const KEY = 'current'

let database: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('resurface', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((error) => {
    database = undefined
    throw error
  })
  return database
}

async function transact(update?: (stored: State) => State): Promise<State> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, update ? 'readwrite' : 'readonly')
    const store = transaction.objectStore(STORE)
    let state = EMPTY
    const read = store.get(KEY)
    read.onsuccess = () => {
      state = read.result ?? EMPTY
      if (update) store.put((state = update(state)), KEY)
    }
    transaction.oncomplete = () => resolve(state)
    transaction.onerror = transaction.onabort = () => reject(transaction.error)
  })
}

export const loadState = () => transact()

export const moveState = (from: State, change: (state: State) => State) =>
  transact((stored) => (samePlace(stored, from) ? change(stored) : stored))

export const resetState = () => transact(() => EMPTY)

export async function importSnapshot(ids: string[], exportedAt: string): Promise<State> {
  const state = await transact((stored) => reconcile(stored, ids, exportedAt))
  navigator.storage?.persist?.().catch(() => {})
  return state
}
