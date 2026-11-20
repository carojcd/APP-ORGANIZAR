/**
 * ETAPA FUTURA — Proveedor de almacenamiento con Supabase.
 *
 * No está implementado ni conectado. Cuando se active:
 *  1. Instalar `@supabase/supabase-js`.
 *  2. Crear las tablas con `supabase/schema.sql` (incluye Row Level Security).
 *  3. Implementar ItemRepository / ConversationRepository traduciendo
 *     ItemFilter a consultas (`.eq`, `.gte`, `.lte`, `.in`).
 *  4. Mapear snake_case (BD) ⇄ camelCase (dominio) en un único lugar.
 *  5. Poner VITE_STORAGE_PROVIDER=supabase.
 *
 * Los componentes de la interfaz no cambian: solo consumen StorageProvider.
 */
import { NotConfiguredError } from '@/lib/errors';
import type { StorageProvider } from '../types';

export function createSupabaseProvider(): StorageProvider {
  throw new NotConfiguredError('Supabase');
}
