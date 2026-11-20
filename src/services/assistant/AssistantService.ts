/**
 * Orquestador del chat:
 *   mensaje del usuario → proveedor IA (interpreta) → ActionExecutor (ejecuta)
 *   → mensaje del asistente con el resultado real.
 * No depende de React; la interfaz solo llama a `send`.
 */
import { LOCALE } from '@/config/locale';
import { CATEGORIES } from '@/domain/categories';
import type { ChatMessage } from '@/domain/types';
import { todayKey } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import type { AIProvider } from '../ai/types';
import type { PendingIntent } from '../ai/types';
import type { StorageProvider } from '../storage/types';
import { ActionExecutor } from './ActionExecutor';

export class AssistantService {
  /** Aclaraciones en espera, por conversación. */
  private readonly pending = new Map<string, PendingIntent>();

  constructor(
    private readonly storage: StorageProvider,
    private readonly ai: AIProvider,
  ) {}

  get provider(): AIProvider {
    return this.ai;
  }

  async send(conversationId: string, text: string): Promise<{ user: ChatMessage; assistant: ChatMessage }> {
    const clean = text.trim().slice(0, 1000);
    const user = await this.storage.conversations.addMessage({ conversationId, role: 'user', text: clean });
    await this.autoTitle(conversationId, clean);

    const now = new Date();
    const today = todayKey(now);
    let assistantInput: Omit<ChatMessage, 'id' | 'createdAt'>;

    try {
      const open = await this.storage.items.list({ statuses: ['pending', 'in_progress'] });
      const interpretation = await this.ai.interpret(clean, {
        now: now.toISOString(),
        today,
        timeZone: LOCALE.timeZone,
        locale: LOCALE.language,
        pending: this.pending.get(conversationId) ?? null,
        openItems: open.map(({ id, title, categoryId, date, time, status, amount }) => ({
          id, title, categoryId, date, time, status, amount,
        })),
        categories: CATEGORIES.map(({ id, label, description }) => ({ id, label, description })),
      });
      const result = await new ActionExecutor({ items: this.storage.items, today }).execute(interpretation.actions);
      if (result.pending) this.pending.set(conversationId, result.pending);
      else this.pending.delete(conversationId);
      assistantInput = {
        conversationId,
        role: 'assistant',
        text: result.text || 'No entendí el mensaje. ¿Puedes decirlo de otra forma?',
        outcomes: result.outcomes,
        quickReplies: result.quickReplies,
        demo: this.ai.isDemo,
      };
    } catch (error) {
      console.error('[assistant]', error);
      this.pending.delete(conversationId);
      assistantInput = {
        conversationId,
        role: 'assistant',
        text: `${toUserMessage(error)} No se guardó ningún cambio.`,
        outcomes: [{ kind: 'error', itemIds: [] }],
        demo: this.ai.isDemo,
      };
    }
    const assistant = await this.storage.conversations.addMessage(assistantInput);
    return { user, assistant };
  }

  hasPending(conversationId: string): boolean {
    return this.pending.has(conversationId);
  }

  private async autoTitle(conversationId: string, text: string) {
    const conversations = await this.storage.conversations.listConversations();
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv && conv.title === 'Nueva conversación') {
      const title = text.length > 42 ? `${text.slice(0, 40).trim()}…` : text;
      await this.storage.conversations.renameConversation(conversationId, title);
    }
  }
}
