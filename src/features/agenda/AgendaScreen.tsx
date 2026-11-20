import { useMemo, useState } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import { effectiveDate } from '@/domain/items';
import { addDays, parseDateKey, weekDays } from '@/lib/dates';
import { MONTHS, WEEKDAYS_SHORT, capitalize, formatLongDate, formatRelativeDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useApp } from '@/state/AppContext';
import { itemsOn } from '@/state/selectors';
import { Card, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { CategoryFilter } from '@/components/items/CategoryFilter';
import { ItemList } from '@/components/items/ItemList';
import { ItemRow } from '@/components/items/ItemRow';
import { Fab } from '@/components/layout/Fab';
import { PageHeader, Screen } from '@/components/layout/PageHeader';

type View = 'day' | 'week';

export function AgendaScreen() {
  const { items, today, openEditor } = useApp();
  const [view, setView] = useState<View>('day');
  const [selected, setSelected] = useState(today);
  const [category, setCategory] = useState<string | null>(null);

  const visible = useMemo(() => (category ? items.filter((i) => i.categoryId === category) : items), [items, category]);
  const days = weekDays(selected);
  const { month, year } = parseDateKey(days[3]);

  const dayItems = itemsOn(visible, selected);
  const timed = dayItems.filter((i) => i.time);
  const untimed = dayItems.filter((i) => !i.time);

  const shiftWeek = (n: number) => setSelected(addDays(selected, n * 7));

  return (
    <Screen>
      <PageHeader
        title="Agenda"
        subtitle={`${capitalize(MONTHS[month - 1])} ${year}`}
        actions={
          <>
            <IconButton label="Semana anterior" onClick={() => shiftWeek(-1)}><ChevronLeft size={22} /></IconButton>
            {selected !== today && (
              <button className="h-9 rounded-full bg-surface-2 px-3 text-sm font-semibold" onClick={() => setSelected(today)}>Hoy</button>
            )}
            <IconButton label="Semana siguiente" onClick={() => shiftWeek(1)}><ChevronRight size={22} /></IconButton>
          </>
        }
      />

      <Segmented
        className="mb-4"
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Día' },
          { value: 'week', label: 'Semana' },
        ]}
      />

      {/* Tira semanal */}
      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const count = itemsOn(visible, d).filter((x) => x.status !== 'done').length;
          const isSel = d === selected;
          return (
            <button
              key={d}
              onClick={() => {
                setSelected(d);
                setView('day');
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl py-2.5 transition',
                isSel ? 'bg-fg text-bg' : d === today ? 'bg-accent-soft text-accent' : 'bg-surface text-fg hover:bg-surface-2',
              )}
            >
              <span className={cn('text-[11px] font-semibold', isSel ? 'opacity-70' : 'text-muted')}>{WEEKDAYS_SHORT[(i + 1) % 7]}</span>
              <span className="text-[17px] font-bold tabular">{parseDateKey(d).day}</span>
              <span className={cn('size-1.5 rounded-full', count ? (isSel ? 'bg-bg' : 'bg-accent') : 'bg-transparent')} />
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <CategoryFilter value={category} onChange={setCategory} />
      </div>

      {view === 'day' ? (
        <section>
          <SectionHeader title={capitalize(formatLongDate(selected))} count={dayItems.length} />
          {dayItems.length === 0 ? (
            <Card className="p-2">
              <EmptyState icon={<CalendarX2 size={24} />} title="Sin actividades" text="Toca + para agregar algo a este día." />
            </Card>
          ) : (
            <div className="space-y-3">
              {timed.length > 0 && (
                <Card className="p-2">
                  {timed.map((item) => (
                    <div key={item.id} className="flex items-stretch gap-1">
                      <div data-cat={item.categoryId} className="my-2 ml-1 w-1 shrink-0 rounded-full bg-[var(--c)]" />
                      <div className="min-w-0 flex-1">
                        <ItemRow item={item} hideDate />
                      </div>
                    </div>
                  ))}
                </Card>
              )}
              {untimed.length > 0 && (
                <Card className="p-2">
                  <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-faint">Todo el día</p>
                  <ItemList items={untimed} hideDate />
                </Card>
              )}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const list = visible.filter((i) => effectiveDate(i) === d);
            return (
              <section key={d}>
                <SectionHeader title={`${formatRelativeDay(d, today)}${['Hoy', 'Mañana', 'Ayer'].includes(formatRelativeDay(d, today)) ? ` · ${capitalize(formatLongDate(d))}` : ''}`} count={list.length} />
                <Card className={cn('p-2', d === today && 'border-accent/40')}>
                  {list.length ? <ItemList items={list} hideDate /> : <p className="px-3 py-3 text-sm text-faint">Libre</p>}
                </Card>
              </section>
            );
          })}
        </div>
      )}
      <Fab onClick={() => openEditor(null, { date: selected, categoryId: category ?? 'personal' })} />
    </Screen>
  );
}
