/**
 * Contratos de persistencia. La interfaz gráfica solo conoce estas
 * interfaces: cambiar IndexedDB por Supabase consiste en entregar otra
 * implementación desde services/storage/index.ts.
 */
import type {
  ChatMessage,
  Conversation,
  Item,
  ItemDraft,
  ItemFilter,
  ItemPatch,
} from '@/domain/types';

export interface ItemRepository {
  list(filter?: ItemFilter): Promise<Item[]>;
  get(id: string): Promise<Item | null>;
  /** Valida y crea. Lanza ValidationError si los datos no son válidos. */
  create(draft: ItemDraft): Promise<Item>;
  update(id: string, patch: ItemPatch): Promise<Item>;
  remove(id: string): Promise<void>;
  /** Devuelve un registro abierto equivalente, si existe. */
  findDuplicate(draft: ItemDraft, ignoreId?: string): Promise<Item | null>;
  /** Inserta registros ya construidos (datos de demostración, restauraciones). */
  bulkPut(items: Item[]): Promise<void>;
  clear(): Promise<void>;
}

export interface ConversationRepository {
  listConversations(): Promise<Conversation[]>;
  createConversation(title?: string): Promise<Conversation>;
  renameConversation(id: string, title: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  addMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage>;
  clear(): Promise<void>;
}

export interface MetaRepository {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

export type StorageChange = { scope: 'items' | 'conversations' };

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Autenticación (solo en proveedores en la nube). */
export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Devuelve el usuario si la sesión queda abierta, o null si hay que confirmar el correo. */
  signUp(email: string, password: string): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  onChange(listener: (user: AuthUser | null) => void): () => void;
}

export interface StorageProvider {
  readonly name: string;
  /** 'local' = solo este dispositivo; 'cloud' = sincronizado. */
  readonly kind: 'local' | 'cloud';
  /** Presente si el proveedor requiere iniciar sesión. */
  readonly auth?: AuthService;
  readonly items: ItemRepository;
  readonly conversations: ConversationRepository;
  readonly meta: MetaRepository;
  /** Notifica cambios para que la interfaz se refresque. Devuelve la función para desuscribirse. */
  subscribe(listener: (change: StorageChange) => void): () => void;
}
