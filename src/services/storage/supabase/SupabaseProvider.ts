/**
 * Almacenamiento en la nube con Supabase (PostgreSQL + Auth + Realtime).
 *
 * Implementa el mismo contrato que IndexedDB: la interfaz no cambia.
 * La URL y la "publishable/anon key" son públicas por diseño; la seguridad
 * la dan las políticas Row Level Security de supabase/schema.sql.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { buildItem, compareItems, isDuplicateOf, matchesFilter } from '@/domain/items';
import type { ChatMessage, Conversation, Item, ItemDraft, ItemFilter, ItemPatch } from '@/domain/types';
import { assertValidDraft, assertValidPatch } from '@/domain/validation';
import { AppError } from '@/lib/errors';
import { createId } from '@/lib/id';
import type {
  AuthService,
  AuthUser,
  ConversationRepository,
  ItemRepository,
  MetaRepository,
  StorageChange,
  StorageProvider,
} from '../types';

type Emit = (change: StorageChange) => void;

/* ───────────── Mapeo BD (snake_case) ⇄ dominio (camelCase) ───────────── */

interface ItemRow {
  id: string;
  title: string;
  description: string;
  category_id: string;
  date: string | null;
  time: string | null;
  priority: Item['priority'];
  status: Item['status'];
  reminder_minutes_before: number | null;
  amount: number | null;
  direction: Item['direction'];
  due_date: string | null;
  source: Item['source'];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const ITEM_COLUMNS =
  'id,title,description,category_id,date,time,priority,status,reminder_minutes_before,amount,direction,due_date,source,created_at,updated_at,completed_at';

export function rowToItem(r: ItemRow): Item {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    categoryId: r.category_id,
    date: r.date,
    time: r.time,
    priority: r.priority,
    status: r.status,
    reminder: r.reminder_minutes_before == null ? null : { enabled: true, minutesBefore: r.reminder_minutes_before },
    amount: r.amount == null ? null : Number(r.amount),
    direction: r.direction,
    dueDate: r.due_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    source: r.source,
  };
}

export function itemToRow(i: Item): ItemRow {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    category_id: i.categoryId,
    date: i.date,
    time: i.time,
    priority: i.priority,
    status: i.status,
    reminder_minutes_before: i.reminder?.enabled ? i.reminder.minutesBefore : null,
    amount: i.amount,
    direction: i.direction,
    due_date: i.dueDate,
    source: i.source,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
    completed_at: i.completedAt,
  };
}

export function patchToRow(p: ItemPatch): Partial<ItemRow> {
  const row: Partial<ItemRow> = {};
  if (p.title !== undefined) row.title = p.title.trim();
  if (p.description !== undefined) row.description = p.description;
  if (p.categoryId !== undefined) row.category_id = p.categoryId;
  if (p.date !== undefined) row.date = p.date;
  if (p.time !== undefined) row.time = p.time;
  if (p.priority !== undefined) row.priority = p.priority;
  if (p.status !== undefined) row.status = p.status;
  if (p.reminder !== undefined) row.reminder_minutes_before = p.reminder?.enabled ? p.reminder.minutesBefore : null;
  if (p.amount !== undefined) row.amount = p.amount;
  if (p.direction !== undefined) row.direction = p.direction;
  if (p.dueDate !== undefined) row.due_date = p.dueDate;
  if (p.source !== undefined) row.source = p.source;
  if (p.completedAt !== undefined) row.completed_at = p.completedAt;
  return row;
}

/** Convierte errores de Supabase/red en mensajes claros. */
function check<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    const { message, code } = result.error;
    if (code === '42P01' || /relation .* does not exist|schema cache/i.test(message)) {
      throw new AppError(message, 'Faltan las tablas en Supabase. Ejecuta supabase/schema.sql en el SQL Editor.');
    }
    if (/JWT|not authenticated|permission denied|row-level security/i.test(message)) {
      throw new AppError(message, 'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.');
    }
    if (/Failed to fetch|NetworkError|network/i.test(message)) {
      throw new AppError(message, 'Sin conexión con la nube. Revisa tu internet.');
    }
    throw new AppError(message, 'No se pudo guardar en la nube. Intenta de nuevo.');
  }
  return result.data;
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(String(error), 'Sin conexión con la nube. Revisa tu internet.', { cause: error });
  }
}

/* ───────────── Repositorios ───────────── */

class SupabaseItemRepository implements ItemRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly emit: Emit,
  ) {}

  async list(filter: ItemFilter = {}): Promise<Item[]> {
    return guard(async () => {
      let q = this.db.from('items').select(ITEM_COLUMNS);
      if (filter.categoryIds?.length) q = q.in('category_id', filter.categoryIds);
      if (filter.statuses?.length) q = q.in('status', filter.statuses);
      if (filter.onlyWithAmount) q = q.not('amount', 'is', null);
      if (filter.from) q = q.gte('effective_date', filter.from);
      if (filter.to) q = q.lte('effective_date', filter.to);
      const rows = check(await q.limit(5000)) as unknown as ItemRow[];
      // El texto y cualquier detalle restante se filtran con la misma regla que en local.
      return rows.map(rowToItem).filter((i) => matchesFilter(i, filter)).sort(compareItems);
    });
  }

  async get(id: string): Promise<Item | null> {
    return guard(async () => {
      const row = check(await this.db.from('items').select(ITEM_COLUMNS).eq('id', id).maybeSingle()) as ItemRow | null;
      return row ? rowToItem(row) : null;
    });
  }

  async create(draft: ItemDraft): Promise<Item> {
    assertValidDraft(draft);
    const item = buildItem(draft);
    await guard(async () => check(await this.db.from('items').insert(itemToRow(item))));
    this.emit({ scope: 'items' });
    return item;
  }

  async update(id: string, patch: ItemPatch): Promise<Item> {
    assertValidPatch(patch);
    const current = await this.get(id);
    if (!current) throw new AppError(`Item ${id} no existe`, 'El registro ya no existe.');
    const now = new Date().toISOString();
    const row = patchToRow(patch);
    row.updated_at = now;
    if (patch.status !== undefined && patch.status !== current.status) row.completed_at = patch.status === 'done' ? now : null;
    const updated = await guard(async () =>
      check(await this.db.from('items').update(row).eq('id', id).select(ITEM_COLUMNS).single()) as unknown as ItemRow,
    );
    this.emit({ scope: 'items' });
    return rowToItem(updated);
  }

  async remove(id: string): Promise<void> {
    await guard(async () => check(await this.db.from('items').delete().eq('id', id)));
    this.emit({ scope: 'items' });
  }

  async findDuplicate(draft: ItemDraft, ignoreId?: string): Promise<Item | null> {
    const open = await this.list({ statuses: ['pending', 'in_progress'] });
    return open.find((i) => i.id !== ignoreId && isDuplicateOf(i, draft)) ?? null;
  }

  async bulkPut(items: Item[]): Promise<void> {
    if (!items.length) return;
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200).map(itemToRow);
      await guard(async () => check(await this.db.from('items').upsert(chunk)));
    }
    this.emit({ scope: 'items' });
  }

  async clear(): Promise<void> {
    await guard(async () => check(await this.db.from('items').delete().neq('id', '')));
    this.emit({ scope: 'items' });
  }
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: ChatMessage['role'];
  text: string;
  outcomes: ChatMessage['outcomes'] | null;
  quick_replies: ChatMessage['quickReplies'] | null;
  demo: boolean;
  created_at: string;
}

const toConversation = (r: { id: string; title: string; created_at: string; updated_at: string }): Conversation => ({
  id: r.id,
  title: r.title,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

class SupabaseConversationRepository implements ConversationRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly emit: Emit,
  ) {}

  async listConversations(): Promise<Conversation[]> {
    return guard(async () => {
      const rows = check(await this.db.from('conversations').select('id,title,created_at,updated_at').order('updated_at', { ascending: false }).limit(200));
      return (rows ?? []).map(toConversation);
    });
  }

  async createConversation(title = 'Nueva conversación'): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = { id: createId(), title, createdAt: now, updatedAt: now };
    await guard(async () =>
      check(await this.db.from('conversations').insert({ id: conversation.id, title, created_at: now, updated_at: now })),
    );
    this.emit({ scope: 'conversations' });
    return conversation;
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await guard(async () => check(await this.db.from('conversations').update({ title }).eq('id', id)));
    this.emit({ scope: 'conversations' });
  }

  async deleteConversation(id: string): Promise<void> {
    await guard(async () => check(await this.db.from('conversations').delete().eq('id', id)));
    this.emit({ scope: 'conversations' });
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    return guard(async () => {
      const rows = check(
        await this.db.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      ) as MessageRow[];
      return rows.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        role: r.role,
        text: r.text,
        createdAt: r.created_at,
        outcomes: r.outcomes ?? undefined,
        quickReplies: r.quick_replies ?? undefined,
        demo: r.demo,
      }));
    });
  }

  async addMessage(input: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const message: ChatMessage = { ...input, id: createId(), createdAt: new Date().toISOString() };
    await guard(async () => {
      check(
        await this.db.from('messages').insert({
          id: message.id,
          conversation_id: message.conversationId,
          role: message.role,
          text: message.text,
          outcomes: message.outcomes ?? null,
          quick_replies: message.quickReplies ?? null,
          demo: Boolean(message.demo),
          created_at: message.createdAt,
        }),
      );
      check(await this.db.from('conversations').update({ updated_at: message.createdAt }).eq('id', message.conversationId));
    });
    this.emit({ scope: 'conversations' });
    return message;
  }

  async clear(): Promise<void> {
    await guard(async () => check(await this.db.from('conversations').delete().neq('id', '')));
    this.emit({ scope: 'conversations' });
  }
}

/** Preferencias menores: se guardan en el dispositivo. */
class LocalMetaRepository implements MetaRepository {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = localStorage.getItem(`meta:${key}`);
      return raw == null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }
  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(`meta:${key}`, JSON.stringify(value));
    } catch { /* sin almacenamiento */ }
  }
}

const toAuthUser = (u: User): AuthUser => ({ id: u.id, email: u.email ?? null });

function authError(message: string): AppError {
  if (/invalid login credentials/i.test(message)) return new AppError(message, 'Correo o contraseña incorrectos.');
  if (/email not confirmed/i.test(message)) return new AppError(message, 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.');
  if (/already registered|already exists/i.test(message)) return new AppError(message, 'Ese correo ya tiene cuenta. Usa "Iniciar sesión".');
  if (/password.*(at least|short|characters)/i.test(message)) return new AppError(message, 'La contraseña debe tener al menos 6 caracteres.');
  if (/signups? not allowed|signup.*disabled/i.test(message)) return new AppError(message, 'El registro de cuentas nuevas está desactivado.');
  if (/rate limit/i.test(message)) return new AppError(message, 'Demasiados intentos. Espera un momento.');
  if (/fetch|network/i.test(message)) return new AppError(message, 'Sin conexión con la nube. Revisa tu internet.');
  return new AppError(message, 'No se pudo iniciar sesión. Intenta de nuevo.');
}

class SupabaseAuthService implements AuthService {
  constructor(private readonly db: SupabaseClient) {}

  async getUser(): Promise<AuthUser | null> {
    const { data } = await this.db.auth.getSession();
    return data.session?.user ? toAuthUser(data.session.user) : null;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.db.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw authError(error?.message ?? 'sin usuario');
    return toAuthUser(data.user);
  }

  async signUp(email: string, password: string): Promise<AuthUser | null> {
    const { data, error } = await this.db.auth.signUp({ email: email.trim(), password });
    if (error) throw authError(error.message);
    // Supabase devuelve un usuario sin identidades si el correo ya existe.
    if (data.user && data.user.identities?.length === 0) throw authError('already registered');
    return data.session?.user ? toAuthUser(data.session.user) : null;
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }

  onChange(listener: (user: AuthUser | null) => void): () => void {
    const { data } = this.db.auth.onAuthStateChange((_event, session) => listener(session?.user ? toAuthUser(session.user) : null));
    return () => data.subscription.unsubscribe();
  }
}

export class SupabaseProvider implements StorageProvider {
  readonly name = 'Nube (Supabase)';
  readonly kind = 'cloud' as const;
  private readonly db: SupabaseClient;
  private readonly listeners = new Set<(c: StorageChange) => void>();
  private readonly emit: Emit = (change) => this.listeners.forEach((l) => l(change));
  readonly items: SupabaseItemRepository;
  readonly conversations: SupabaseConversationRepository;
  readonly meta = new LocalMetaRepository();
  readonly auth: SupabaseAuthService;

  constructor(url: string, publicKey: string) {
    this.db = createClient(url, publicKey, { auth: { persistSession: true, autoRefreshToken: true } });
    this.items = new SupabaseItemRepository(this.db, this.emit);
    this.conversations = new SupabaseConversationRepository(this.db, this.emit);
    this.auth = new SupabaseAuthService(this.db);

    // Cambios hechos desde otro dispositivo llegan en vivo.
    this.db
      .channel('cambios-usuario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => this.emit({ scope: 'items' }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => this.emit({ scope: 'conversations' }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => this.emit({ scope: 'conversations' }))
      .subscribe();

    // Respaldo: al volver a la app se refrescan los datos.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.emit({ scope: 'items' });
      });
    }
  }

  subscribe(listener: (change: StorageChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
