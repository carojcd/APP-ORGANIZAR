/**
 * Lectura tipada de variables de entorno públicas (prefijo VITE_).
 * Las claves secretas (GEMINI_API_KEY, etc.) NUNCA deben vivir aquí:
 * pertenecen al backend.
 */
export type AIProviderName = 'auto' | 'demo' | 'gemini';
export type StorageProviderName = 'auto' | 'local' | 'supabase';

function read(name: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

export const env = {
  aiProvider: (read('VITE_AI_PROVIDER') ?? 'auto') as AIProviderName,
  aiEndpoint: read('VITE_AI_ENDPOINT') ?? '/api/ai/interpret',
  storageProvider: (read('VITE_STORAGE_PROVIDER') ?? 'auto') as StorageProviderName,
  supabaseUrl: read('VITE_SUPABASE_URL'),
  // Acepta la clave nueva (publishable) o la antigua (anon); ambas son públicas.
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY') ?? read('VITE_SUPABASE_PUBLISHABLE_KEY'),
  fcmVapidKey: read('VITE_FCM_VAPID_KEY'),
} as const;
