import { env } from '@/config/env';
import { IndexedDBProvider } from './indexeddb/IndexedDBProvider';
import type { StorageProvider } from './types';

let instance: StorageProvider | null = null;

/**
 * Punto único de creación del almacenamiento.
 * Hoy siempre devuelve IndexedDB; Supabase se habilitará en una etapa futura.
 */
export function getStorage(): StorageProvider {
  if (instance) return instance;
  if (env.storageProvider === 'supabase') {
    console.warn('[storage] Supabase aún no está implementado; se usa IndexedDB local.');
  }
  instance = new IndexedDBProvider();
  return instance;
}

export type { StorageProvider, ItemRepository, ConversationRepository } from './types';
