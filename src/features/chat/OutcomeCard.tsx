import { useState } from 'react';
import { ArrowRight, CircleCheck, CircleSlash, Copy, PencilLine, Plus, Trash2, Undo2 } from 'lucide-react';
import type { ActionOutcome, Item } from '@/domain/types';
import { useApp } from '@/state/AppContext';
import { ItemRow } from '@/components/items/ItemRow';

const META: Record<string, { label: string; icon: typeof Plus; tone: string }> = {
  created: { label: 'Creado', icon: Plus, tone: 'text-success' },
  updated: { label: 'Actualizado', icon: PencilLine, tone: 'text-accent' },
  completed: { label: 'Completado', icon: CircleCheck, tone: 'text-success' },
  deleted: { label: 'Eliminado', icon: Trash2, tone: 'text-danger' },
  duplicate: { label: 'Ya existía', icon: Copy, tone: 'text-warning' },
};

/** Tarjeta con el resultado verificable de una acción del asistente. */
export function OutcomeCard({ outcome }: { outcome: ActionOutcome }) {
  const { items, storage, toast, navigate, updateItem, restoreItems } = useApp();
  const [undone, setUndone] = useState(false);

  if (outcome.kind === 'error' || outcome.kind === 'not_found') return null;

  const live = (id: string): Item | undefined => items.find((i) => i.id === id);

  if (outcome.kind === 'listed') {
    const list = outcome.itemIds.map(live).filter((i): i is Item => Boolean(i));
    const shown = list.slice(0, 8);
    return (
      <div className="mt-2 rounded-2xl border border-line bg-surface p-1.5">
        {shown.map((i) => <ItemRow key={i.id} item={i} compact />)}
        {list.length === 0 && <p className="px-3 py-2 text-sm text-faint">Estos registros ya no existen.</p>}
        {list.length > shown.length && (
          <button className="flex w-full items-center justify-center gap-1 py-2 text-sm font-semibold text-accent" onClick={() => navigate('tasks')}>
            Ver {list.length - shown.length} más <ArrowRight size={15} />
          </button>
        )}
      </div>
    );
  }

  const meta = META[outcome.kind];
  const snapshot = outcome.snapshots?.[0];
  const id = outcome.itemIds[0];
  const item = id ? live(id) : undefined;
  const Icon = meta.icon;

  const undo = async () => {
    try {
      if (outcome.kind === 'created' && id) await storage.items.remove(id);
      if (outcome.kind === 'completed' && id) await updateItem(id, { status: 'pending' });
      if (outcome.kind === 'deleted' && snapshot) await restoreItems([snapshot]);
      setUndone(true);
      toast('Acción deshecha');
    } catch {
      toast('No se pudo deshacer', { tone: 'error' });
    }
  };

  const canUndo = !undone && (outcome.kind === 'created' ? Boolean(item) : outcome.kind === 'completed' ? item?.status === 'done' : outcome.kind === 'deleted' ? !item : false);

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${undone ? 'text-faint' : meta.tone}`}>
          {undone ? <CircleSlash size={14} /> : <Icon size={14} strokeWidth={2.6} />}
          {undone ? 'Deshecho' : meta.label}
        </span>
        {canUndo && (
          <button className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg" onClick={() => void undo()}>
            <Undo2 size={14} /> {outcome.kind === 'deleted' ? 'Restaurar' : 'Deshacer'}
          </button>
        )}
      </div>
      <div className="p-1">
        {item ? (
          <ItemRow item={item} compact />
        ) : snapshot ? (
          <p className="px-2 py-2 text-[15px] font-semibold text-faint line-through">{snapshot.title}</p>
        ) : null}
      </div>
    </div>
  );
}
