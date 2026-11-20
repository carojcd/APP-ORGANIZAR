import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Info, SquarePen } from 'lucide-react';
import type { ChatMessage } from '@/domain/types';
import { formatTime } from '@/lib/format';
import { nowTimeKey } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { EXAMPLE_PROMPTS } from '@/services/ai/demo/DemoProvider';
import { useApp } from '@/state/AppContext';
import { IconButton } from '@/components/ui/Button';
import { Composer } from './Composer';
import { HistorySheet } from './HistorySheet';
import { OutcomeCard } from './OutcomeCard';

const CURRENT_KEY = 'current-conversation';

const SUGGESTIONS = [
  'Mañana tengo una reunión con Don Vitto a las 9 de la mañana',
  'Recuérdame pagar Falabella el próximo viernes',
  'Agrega un pago pendiente de servicios públicos por $350.000',
  '¿Qué tengo pendiente hoy?',
  'Marca como completada la entrega de FLM',
  'Cambia la reunión de mañana para las 3 de la tarde',
];

function readCurrent(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function ChatScreen() {
  const { storage, assistant, voiceRequested, consumeVoiceRequest, toast } = useApp();
  const [conversationId, setConversationId] = useState<string | null>(readCurrent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const select = useCallback((id: string | null) => {
    setConversationId(id);
    try {
      if (id) localStorage.setItem(CURRENT_KEY, id);
      else localStorage.removeItem(CURRENT_KEY);
    } catch { /* sin almacenamiento */ }
  }, []);

  // Carga mensajes de la conversación actual (y verifica que exista).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!conversationId) return setMessages([]);
      const list = await storage.conversations.listMessages(conversationId);
      if (cancelled) return;
      if (list.length === 0) {
        const exists = (await storage.conversations.listConversations()).some((c) => c.id === conversationId);
        if (!exists) return select(null);
      }
      setMessages(list);
    };
    void load();
    const unsub = storage.subscribe((c) => c.scope === 'conversations' && void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [conversationId, storage, select]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  const send = async (text: string) => {
    if (sending) return;
    setSending(true);
    try {
      let id = conversationId;
      if (!id) {
        id = (await storage.conversations.createConversation()).id;
        select(id);
      }
      // Muestra el mensaje del usuario de inmediato.
      setMessages((m) => [...m, { id: 'tmp', conversationId: id!, role: 'user', text, createdAt: new Date().toISOString() }]);
      await assistant.send(id, text);
    } catch {
      toast('No se pudo enviar el mensaje', { tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  const last = messages[messages.length - 1];
  const isDemo = assistant.provider.isDemo;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col pb-[calc(68px+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="flex items-center gap-2 border-b border-line px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Asistente</h1>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className={cn('size-1.5 rounded-full', isDemo ? 'bg-warning' : 'bg-success')} />
            {isDemo ? 'Modo demostración · intérprete local' : assistant.provider.label}
          </p>
        </div>
        <IconButton label="Historial" tone="soft" onClick={() => setHistoryOpen(true)}><History size={19} /></IconButton>
        <IconButton label="Nueva conversación" tone="soft" onClick={() => select(null)}><SquarePen size={19} /></IconButton>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !sending ? (
          <div className="flex min-h-full flex-col justify-end animate-fade-up">
            <div className="mb-5">
              <img src="/icons/icon.svg" alt="" className="mb-4 size-12 rounded-2xl" />
              <h2 className="text-2xl font-extrabold tracking-tight">¿Qué organizamos hoy?</h2>
              <p className="mt-1 text-[15px] text-muted">Escríbeme o dicta tareas, citas y pagos con tus palabras. También puedes preguntarme qué tienes pendiente.</p>
            </div>
            {isDemo && (
              <p className="mb-4 flex gap-2 rounded-2xl bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
                <Info size={16} className="mt-0.5 shrink-0" />
                Estás en modo demostración: un intérprete local entiende frases comunes. Los cambios sí se guardan en este dispositivo. Para activar Gemini, agrega tu clave en .env.local.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => void send(s)} className="rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[14px] font-medium transition hover:border-accent/50 active:scale-[0.99]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex w-fit gap-1 rounded-3xl rounded-bl-lg bg-surface px-4 py-3.5 shadow-card" aria-label="El asistente está pensando">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="typing-dot size-2 rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            {!sending && last?.role === 'assistant' && (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1">
                {(last.quickReplies?.length ? last.quickReplies : EXAMPLE_PROMPTS).map((q) => (
                  <button key={q.label} onClick={() => void send(q.value)} className="h-9 shrink-0 rounded-full border border-accent/30 bg-accent-soft px-3.5 text-sm font-semibold text-accent active:scale-95">
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Composer onSend={(t) => void send(t)} disabled={sending} autoStartVoice={voiceRequested} onVoiceStarted={consumeVoiceRequest} />

      <HistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentId={conversationId}
        onSelect={select}
        onDeleted={(id) => id === conversationId && select(null)}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user';
  const time = formatTime(nowTimeKey(new Date(message.createdAt)));
  return (
    <div className={cn('flex flex-col animate-fade-up', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[86%] whitespace-pre-line px-4 py-2.5 text-[15px] leading-relaxed',
          mine ? 'rounded-3xl rounded-br-lg bg-accent text-accent-fg' : 'rounded-3xl rounded-bl-lg bg-surface shadow-card',
        )}
      >
        {message.text}
      </div>
      {!mine && message.outcomes?.length ? (
        <div className="w-full max-w-[86%]">
          {message.outcomes.map((o, i) => <OutcomeCard key={i} outcome={o} />)}
        </div>
      ) : null}
      <span className="mt-1 px-2 text-[11px] text-faint">{time}</span>
    </div>
  );
}
