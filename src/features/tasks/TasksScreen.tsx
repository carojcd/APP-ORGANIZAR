import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { effectiveDate } from '@/domain/items';
import type { Item } from '@/domain/types';
import { addDays, endOfWeek } from '@/lib/dates';
import { useApp } from '@/state/AppContext';
import { isOpen } from '@/state/selectors';
import { Card, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { CategoryFilter } from '@/components/items/CategoryFilter';
import { ItemList } from '@/components/items/ItemList';
import { Fab } from '@/components/layout/Fab';
import { PageHeader, Screen } from '@/components/layout/PageHeader';
import { takeTaskCategory } from './taskFilterStore';

type StatusFilter = 'open' | 'done' | 'all';

function group(items: Item[], today: string): { title: string; items: Item[] }[] {
  const tomorrow = addDays(today, 1);
  const weekEnd = endOfWeek(today);
  const buckets: Record<string, Item[]> = { Vencidas: [], Hoy: [], Mañana: [], 'Esta semana': [], 'Más adelante': [], 'Sin fecha': [] };
  for (const item of items) {
    const d = effectiveDate(item);
    if (!d) buckets['Sin fecha'].push(item);
    else if (d < today) (isOpen(item) ? buckets.Vencidas : buckets.Hoy).push(item);
    else if (d === today) buckets.Hoy.push(item);
    else if (d === tomorrow) buckets['Mañana'].push(item);
    else if (d <= weekEnd) buckets['Esta semana'].push(item);
    else buckets['Más adelante'].push(item);
  }
  return Object.entries(buckets).filter(([, list]) => list.length).map(([title, list]) => ({ title, items: list }));
}

export function TasksScreen() {
  const { items, today, openEditor } = useApp();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [category, setCategory] = useState<string | null>(() => takeTaskCategory());

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (category === null || i.categoryId === category) &&
          (status === 'all' || (status === 'open' ? isOpen(i) : !isOpen(i))),
      ),
    [items, category, status],
  );
  const groups = useMemo(
    () => (status === 'done' ? [{ title: 'Completadas', items: [...filtered].reverse() }] : group(filtered, today)),
    [filtered, status, today],
  );
  const openCount = items.filter(isOpen).length;
  const doneCount = items.length - openCount;

  return (
    <Screen>
      <PageHeader title="Tareas" subtitle={`${openCount} pendientes · ${doneCount} completadas`} />
      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-bg/90 px-4 pb-3 pt-1 backdrop-blur-xl">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Pendientes' },
            { value: 'done', label: 'Completadas' },
            { value: 'all', label: 'Todas' },
          ]}
        />
        <CategoryFilter value={category} onChange={setCategory} />
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<ListChecks size={24} />} title={status === 'done' ? 'Aún no hay completadas' : 'Sin pendientes'} text="Crea uno con el botón + o pídeselo al asistente." />
      ) : (
        groups.map((g) => (
          <section key={g.title} className="mt-4">
            <SectionHeader title={g.title} count={g.items.length} />
            <Card className={g.title === 'Vencidas' ? 'border-danger/30 p-2' : 'p-2'}>
              <ItemList items={g.items} hideDate={g.title === 'Hoy' || g.title === 'Mañana'} />
            </Card>
          </section>
        ))
      )}
      <Fab onClick={() => openEditor(null, { categoryId: category ?? 'personal', date: today })} />
    </Screen>
  );
}
