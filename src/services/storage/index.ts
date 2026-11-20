import { env } from '@/config/env';
import { IndexedDBProvider } from './indexeddb/IndexedDBProvider';
import { SupabaseProvider } from './supabase/SupabaseProvider';
import type { StorageProvider } from './types';

let instance: StorageProvider | null = null;

/** ¿Hay datos de conexión a Supabase en .env.local? */
export function isCloudConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/**
 * Punto único de creación del almacenamiento:
 *  - Con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY → nube (Supabase), con inicio de sesión.
 *  - Sin ellas, o con VITE_STORAGE_PROVIDER=local → este dispositivo (IndexedDB).
 */
export function getStorage(): StorageProvider {
  if (instance) return instance;
  instance =
    isCloudConfigured() && env.storageProvider !== 'local'
      ? new SupabaseProvider(env.supabaseUrl!, env.supabaseAnonKey!)
      : new IndexedDBProvider();
  return instance;
}

/** Acceso directo a los datos locales (para subirlos a la nube). */
export function getLocalStorage(): StorageProvider {
  return instance?.kind === 'local' ? instance : new IndexedDBProvider();
}

export type { StorageProvider, ItemRepository, ConversationRepository, AuthUser } from './types';
