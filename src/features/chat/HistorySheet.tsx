import { useEffect, useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import type { Conversation } from '@/domain/types';
import { formatDate, formatTime } from '@/lib/format';
import { nowTimeKey, todayKey } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { useApp } from '@/state/AppContext';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  currentId: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}

function stamp(iso: string, today: string) {
  const d = new Date(iso);
  const day = todayKey(d);
  return day === today ? formatTime(nowTimeKey(d)) : formatDate(day);
}

export function HistorySheet({ open, onClose, currentId, onSelect, onDeleted }: Props) {
  const { storage, today } = useApp();
  const [list, setList] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = () => void storage.conversations.listConversations().then(setList);
    load();
    return storage.subscribe((c) => c.scope === 'conversations' && load());
  }, [open, storage]);

  return (
    <Sheet open={open} onClose={onClose} title="Historial de conversaciones">
      {list.length === 0 ? (
        <EmptyState icon={<MessageSquare size={24} />} title="Sin conversaciones todavía" />
      ) : (
        <ul className="space-y-1">
          {list.map((c) => (
            <li key={c.id} className={cn('flex items-center gap-2 rounded-2xl pr-1', c.id === currentId ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
              <button
                className="min-w-0 flex-1 px-3 py-3 text-left"
                onClick={() => {
                  onSelect(c.id);
                  onClose();
                }}
              >
                <p className="truncate text-[15px] font-semibold">{c.title}</p>
                <p className="text-xs text-muted">{stamp(c.updatedAt, today)}</p>
              </button>
              <IconButton
                label="Eliminar conversación"
                size="sm"
                onClick={async () => {
                  await storage.conversations.deleteConversation(c.id);
                  onDeleted(c.id);
                }}
              >
                <Trash2 size={17} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
