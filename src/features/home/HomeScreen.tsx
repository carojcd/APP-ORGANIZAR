import { useMemo, useState } from 'react';
import { AlarmClock, ArrowUpRight, CalendarCheck, ChevronRight, Mic, Settings, Sparkles } from 'lucide-react';
import { CATEGORIES } from '@/domain/categories';
import { capitalize, formatCOP, formatLongDate, greeting } from '@/lib/format';
import { useApp } from '@/state/AppContext';
import { daySummary, financeSummary, isOpen, itemsOn, upcomingDeadlines } from '@/state/selectors';
import { Card, SectionHeader } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ItemList } from '@/components/items/ItemList';
import { PageHeader, Screen } from '@/components/layout/PageHeader';
import { SettingsSheet } from '@/features/settings/SettingsSheet';
import { setTaskCategory } from '@/features/tasks/taskFilterStore';

export function HomeScreen() {
  const { items, today, navigate, requestVoice } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const summary = useMemo(() => daySummary(items, today), [items, today]);
  const todays = useMemo(() => itemsOn(items, today), [items, today]);
  const deadlines = useMemo(() => upcomingDeadlines(items, today).slice(0, 5), [items, today]);
  const finance = useMemo(() => financeSummary(items, today), [items, today]);
  const byCategory = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, count: items.filter((i) => i.categoryId === c.id && isOpen(i)).length })),
    [items],
  );

  return (
    <Screen>
      <PageHeader
        subtitle={capitalize(formatLongDate(today))}
        title={greeting()}
        actions={
          <IconButton label="Configuración" tone="soft" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} />
          </IconButton>
        }
      />

      {/* Acceso rápido al asistente */}
      <div className="mb-5 flex items-center gap-2 rounded-[26px] border border-line bg-surface p-2 pl-4 shadow-card">
        <Sparkles size={20} className="shrink-0 text-accent" />
        <button className="h-11 flex-1 truncate text-left text-[15px] text-muted" onClick={() => navigate('chat')}>
          Escribe o dicta lo que necesitas…
        </button>
        <IconButton
          label="Dictar por voz"
          tone="accent"
          size="lg"
          onClick={() => {
            requestVoice();
            navigate('chat');
          }}
        >
          <Mic size={21} />
        </IconButton>
      </div>

      {/* Resumen del día */}
      <Card className="mb-6 p-5">
        <div className="flex items-center gap-5">
          <ProgressRing value={summary.done} total={summary.total} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-muted">Tu día</p>
            <p className="text-lg font-bold leading-snug tracking-tight">
              {summary.total === 0
                ? 'Día libre de pendientes'
                : summary.pending === 0
                  ? '¡Todo listo por hoy!'
                  : `${summary.pending} ${summary.pending === 1 ? 'pendiente' : 'pendientes'} por hoy`}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span className="text-muted"><b className="text-fg tabular">{summary.done}</b> {summary.done === 1 ? 'completada' : 'completadas'}</span>
              <span className="text-muted"><b className="text-fg tabular">{summary.pending}</b> {summary.pending === 1 ? 'pendiente' : 'pendientes'}</span>
              {summary.overdue > 0 && (
                <button className="font-semibold text-danger" onClick={() => navigate('tasks')}>
                  {summary.overdue} {summary.overdue === 1 ? 'vencida' : 'vencidas'}
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Hoy */}
      <section className="mb-6">
        <SectionHeader
          title="Hoy"
          count={todays.length}
          action={
            <button className="flex items-center text-sm font-semibold text-accent" onClick={() => navigate('agenda')}>
              Agenda <ChevronRight size={16} />
            </button>
          }
        />
        <Card className="p-2">
          {todays.length ? (
            <ItemList items={todays} hideDate />
          ) : (
            <EmptyState icon={<CalendarCheck size={24} />} title="Nada programado para hoy" text='Dile al asistente algo como "Hoy a las 5 de la tarde llamar a Juan".' />
          )}
        </Card>
      </section>

      {/* Próximos vencimientos */}
      <section className="mb-6">
        <SectionHeader title="Próximos vencimientos" count={deadlines.length} />
        <Card className="p-2">
          {deadlines.length ? (
            <ItemList items={deadlines} />
          ) : (
            <EmptyState icon={<AlarmClock size={24} />} title="Sin vencimientos cercanos" />
          )}
        </Card>
      </section>

      {/* Pagos del mes + categorías */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5" data-cat="finance">
          <button className="w-full text-left" onClick={() => navigate('finance')}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-muted">Por pagar este mes</span>
              <ArrowUpRight size={18} className="text-muted" />
            </div>
            <p className="mt-1 text-2xl font-extrabold tracking-tight tabular">{formatCOP(finance.payPendingMonth)}</p>
            <p className="mt-1 text-[13px] text-muted">
              {finance.countPendingMonth} {finance.countPendingMonth === 1 ? 'pago pendiente' : 'pagos pendientes'}
              {finance.payOverdue > 0 && <span className="font-semibold text-danger"> · {formatCOP(finance.payOverdue)} vencido</span>}
            </p>
          </button>
        </Card>
        <Card className="p-3">
          <p className="px-2 pb-1 pt-1 text-[13px] font-semibold text-muted">Pendientes por categoría</p>
          <div className="grid grid-cols-2 gap-1">
            {byCategory.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setTaskCategory(c.id);
                  navigate('tasks');
                }}
                className="flex items-center gap-2.5 rounded-2xl p-2 text-left transition hover:bg-surface-2"
              >
                <CategoryBadge categoryId={c.id} size={32} />
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-none tabular">{c.count}</span>
                  <span className="block truncate text-xs text-muted">{c.label}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </section>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Screen>
  );
}
