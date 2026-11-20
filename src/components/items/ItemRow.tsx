import { Bell, Check, Flag } from 'lucide-react';
import { getCategory } from '@/domain/categories';
import { effectiveDate } from '@/domain/items';
import type { Item } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatCOP, formatTime, formatWhen } from '@/lib/format';
import { useApp } from '@/state/AppContext';
import { isOverdue } from '@/state/selectors';

interface Props {
  item: Item;
  /** Oculta la fecha (p. ej. en la agenda del día, donde ya es obvia). */
  hideDate?: boolean;
  compact?: boolean;
}

export function ItemRow({ item, hideDate, compact }: Props) {
  const { today, toggleDone, openEditor } = useApp();
  const done = item.status === 'done';
  const overdue = isOverdue(item, today);
  const cat = getCategory(item.categoryId);
  const date = effectiveDate(item);
  const when = hideDate ? (item.time ? formatTime(item.time) : null) : formatWhen(date, item.time, today);

  return (
    <div data-cat={item.categoryId} className={cn('group flex items-center gap-3 rounded-2xl px-2 transition hover:bg-surface-2/60', compact ? 'py-2' : 'py-2.5')}>
      <button
        onClick={() => void toggleDone(item)}
        aria-label={done ? `Marcar «${item.title}» como pendiente` : `Completar «${item.title}»`}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90',
          done ? 'border-[var(--c)] bg-[var(--c)] text-white dark:text-black' : 'border-[var(--c)]/60 hover:bg-[var(--c-soft)]',
        )}
        style={done ? undefined : { borderColor: 'color-mix(in srgb, var(--c) 55%, transparent)' }}
      >
        {done && <Check size={14} strokeWidth={3.2} />}
      </button>

      <button className="min-w-0 flex-1 text-left" onClick={() => openEditor(item)}>
        <p className={cn('truncate text-[15px] font-semibold leading-snug', done && 'text-faint line-through decoration-1')}>{item.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--c)]" />
          <span className="shrink-0">{cat.label}</span>
          {when && (
            <>
              <span className="text-faint">·</span>
              <span className={cn('truncate', overdue && 'font-semibold text-danger')}>{overdue ? `Vencido · ${when}` : when}</span>
            </>
          )}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        {item.reminder?.enabled && !done && <Bell size={14} className="text-faint" aria-label="Con recordatorio" />}
        {item.priority === 'high' && !done && <Flag size={14} className="text-danger" fill="currentColor" aria-label="Prioridad alta" />}
        {item.amount != null && (
          <span className={cn('text-sm font-bold tabular', done ? 'text-faint' : item.direction === 'collect' ? 'text-success' : 'text-fg')}>
            {item.direction === 'collect' ? '+' : ''}
            {formatCOP(item.amount)}
          </span>
        )}
      </div>
    </div>
  );
}
