import { assertValidDraft, assertValidPatch } from '@/domain/validation';
import { buildItem, compareItems, isDuplicateOf, matchesFilter } from '@/domain/items';
import type { ChatMessage, Conversation, Item, ItemDraft, ItemFilter, ItemPatch } from '@/domain/types';
import { AppError } from '@/lib/errors';
import { createId } from '@/lib/id';
import type {
  ConversationRepository,
  ItemRepository,
  MetaRepository,
  StorageChange,
  StorageProvider,
} from '../types';
import { STORES, promisify, withStore } from './db';

type Emit = (change: StorageChange) => void;

class IndexedDBItemRepository implements ItemRepository {
  constructor(private readonly emit: Emit) {}

  async list(filter?: ItemFilter): Promise<Item[]> {
    const all = await withStore(STORES.items, 'readonly', (tx) =>
      promisify(tx.objectStore(STORES.items).getAll() as IDBRequest<Item[]>),
    );
    return all.filter((i) => matchesFilter(i, filter)).sort(compareItems);
  }

  async get(id: string): Promise<Item | null> {
    const item = await withStore(STORES.items, 'readonly', (tx) =>
      promisify(tx.objectStore(STORES.items).get(id) as IDBRequest<Item | undefined>),
    );
    return item ?? null;
  }

  async create(draft: ItemDraft): Promise<Item> {
    assertValidDraft(draft);
    const item = buildItem(draft);
    await withStore(STORES.items, 'readwrite', (tx) => promisify(tx.objectStore(STORES.items).add(item)));
    this.emit({ scope: 'items' });
    return item;
  }

  async update(id: string, patch: ItemPatch): Promise<Item> {
    assertValidPatch(patch);
    const updated = await withStore(STORES.items, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.items);
      const current = (await promisify(store.get(id))) as Item | undefined;
      if (!current) throw new AppError(`Item ${id} no existe`, 'El registro ya no existe.');
      const now = new Date().toISOString();
      const next: Item = { ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: now };
      if (patch.title !== undefined) next.title = patch.title.trim();
      if (patch.status !== undefined && patch.status !== current.status) {
        next.completedAt = patch.status === 'done' ? now : null;
      }
      await promisify(store.put(next));
      return next;
    });
    this.emit({ scope: 'items' });
    return updated;
  }

  async remove(id: string): Promise<void> {
    await withStore(STORES.items, 'readwrite', (tx) => promisify(tx.objectStore(STORES.items).delete(id)));
    this.emit({ scope: 'items' });
  }

  async findDuplicate(draft: ItemDraft, ignoreId?: string): Promise<Item | null> {
    const open = await this.list({ statuses: ['pending', 'in_progress'] });
    return open.find((i) => i.id !== ignoreId && isDuplicateOf(i, draft)) ?? null;
  }

  async bulkPut(items: Item[]): Promise<void> {
    await withStore(STORES.items, 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.items);
      items.forEach((i) => store.put(i));
    });
    this.emit({ scope: 'items' });
  }

  async clear(): Promise<void> {
    await withStore(STORES.items, 'readwrite', (tx) => promisify(tx.objectStore(STORES.items).clear()));
    this.emit({ scope: 'items' });
  }
}

class IndexedDBConversationRepository implements ConversationRepository {
  constructor(private readonly emit: Emit) {}

  async listConversations(): Promise<Conversation[]> {
    const all = await withStore(STORES.conversations, 'readonly', (tx) =>
      promisify(tx.objectStore(STORES.conversations).getAll() as IDBRequest<Conversation[]>),
    );
    return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async createConversation(title = 'Nueva conversación'): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = { id: createId(), title, createdAt: now, updatedAt: now };
    await withStore(STORES.conversations, 'readwrite', (tx) =>
      promisify(tx.objectStore(STORES.conversations).add(conversation)),
    );
    this.emit({ scope: 'conversations' });
    return conversation;
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await withStore(STORES.conversations, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.conversations);
      const current = (await promisify(store.get(id))) as Conversation | undefined;
      if (current) await promisify(store.put({ ...current, title }));
    });
    this.emit({ scope: 'conversations' });
  }

  async deleteConversation(id: string): Promise<void> {
    await withStore([STORES.conversations, STORES.messages], 'readwrite', async (tx) => {
      tx.objectStore(STORES.conversations).delete(id);
      const index = tx.objectStore(STORES.messages).index('conversationId');
      const keys = await promisify(index.getAllKeys(IDBKeyRange.only(id)));
      keys.forEach((k) => tx.objectStore(STORES.messages).delete(k));
    });
    this.emit({ scope: 'conversations' });
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const messages = await withStore(STORES.messages, 'readonly', (tx) =>
      promisify(
        tx.objectStore(STORES.messages).index('conversationId').getAll(IDBKeyRange.only(conversationId)) as IDBRequest<
          ChatMessage[]
        >,
      ),
    );
    return messages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  async addMessage(input: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const message: ChatMessage = { ...input, id: createId(), createdAt: new Date().toISOString() };
    await withStore([STORES.messages, STORES.conversations], 'readwrite', async (tx) => {
      tx.objectStore(STORES.messages).add(message);
      const convStore = tx.objectStore(STORES.conversations);
      const conv = (await promisify(convStore.get(input.conversationId))) as Conversation | undefined;
      if (conv) convStore.put({ ...conv, updatedAt: message.createdAt });
    });
    this.emit({ scope: 'conversations' });
    return message;
  }

  async clear(): Promise<void> {
    await withStore([STORES.conversations, STORES.messages], 'readwrite', (tx) => {
      tx.objectStore(STORES.conversations).clear();
      tx.objectStore(STORES.messages).clear();
    });
    this.emit({ scope: 'conversations' });
  }
}

class IndexedDBMetaRepository implements MetaRepository {
  async get<T>(key: string): Promise<T | undefined> {
    return withStore(STORES.meta, 'readonly', (tx) =>
      promisify(tx.objectStore(STORES.meta).get(key) as IDBRequest<T | undefined>),
    );
  }
  async set<T>(key: string, value: T): Promise<void> {
    await withStore(STORES.meta, 'readwrite', (tx) => promisify(tx.objectStore(STORES.meta).put(value, key)));
  }
}

export class IndexedDBProvider implements StorageProvider {
  readonly name = 'Este dispositivo (IndexedDB)';
  readonly kind = 'local' as const;
  private readonly listeners = new Set<(c: StorageChange) => void>();
  private readonly emit: Emit = (change) => this.listeners.forEach((l) => l(change));
  readonly items = new IndexedDBItemRepository(this.emit);
  readonly conversations = new IndexedDBConversationRepository(this.emit);
  readonly meta = new IndexedDBMetaRepository();

  subscribe(listener: (change: StorageChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
