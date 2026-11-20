/**
 * Envoltorio mínimo de IndexedDB basado en promesas (sin dependencias).
 */
export const DB_NAME = 'mi-asistente';
export const DB_VERSION = 1;

export const STORES = {
  items: 'items',
  conversations: 'conversations',
  messages: 'messages',
  meta: 'meta',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Migraciones por versión: añade bloques nuevos, nunca modifiques los anteriores.
      if (!db.objectStoreNames.contains(STORES.items)) {
        const items = db.createObjectStore(STORES.items, { keyPath: 'id' });
        items.createIndex('categoryId', 'categoryId');
        items.createIndex('status', 'status');
        items.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains(STORES.conversations)) {
        db.createObjectStore(STORES.conversations, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.messages)) {
        const messages = db.createObjectStore(STORES.messages, { keyPath: 'id' });
        messages.createIndex('conversationId', 'conversationId');
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('No se pudo abrir la base de datos local.'));
    };
  });
  return dbPromise;
}

export function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Ejecuta trabajo dentro de una transacción y espera a que se confirme. */
export async function withStore<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  const tx = db.transaction(storeNames, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada'));
  });
  const result = await work(tx);
  await done;
  return result;
}
