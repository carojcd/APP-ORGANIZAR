import { CalendarDays, House, ListChecks, Sparkles, Wallet } from 'lucide-react';
import type { Route } from '@/hooks/useHashRoute';
import { cn } from '@/lib/cn';
import { useApp } from '@/state/AppContext';

const ITEMS: { route: Route; label: string; icon: typeof House }[] = [
  { route: 'home', label: 'Inicio', icon: House },
  { route: 'agenda', label: 'Agenda', icon: CalendarDays },
  { route: 'chat', label: 'Asistente', icon: Sparkles },
  { route: 'tasks', label: 'Tareas', icon: ListChecks },
  { route: 'finance', label: 'Pagos', icon: Wallet },
];

/** Barra inferior para uso con una mano; el asistente queda al centro, al alcance del pulgar. */
export function BottomNav() {
  const { route, navigate } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 pb-safe backdrop-blur-xl lg:hidden" aria-label="Navegación principal">
      <div className="mx-auto flex h-[68px] max-w-lg items-center justify-around px-2">
        {ITEMS.map(({ route: r, label, icon: Icon }) => {
          const active = route === r;
          if (r === 'chat') {
            return (
              <button key={r} onClick={() => navigate(r)} aria-label={label} aria-current={active ? 'page' : undefined} className="-mt-7 flex flex-col items-center gap-1">
                <span className={cn('flex size-14 items-center justify-center rounded-[22px] bg-accent text-accent-fg shadow-float transition active:scale-95', active && 'ring-4 ring-accent-soft')}>
                  <Icon size={24} strokeWidth={2.2} />
                </span>
                <span className={cn('text-[11px] font-semibold', active ? 'text-fg' : 'text-muted')}>{label}</span>
              </button>
            );
          }
          return (
            <button key={r} onClick={() => navigate(r)} aria-current={active ? 'page' : undefined} className="flex w-16 flex-col items-center gap-1 py-1">
              <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition', active ? 'bg-accent-soft text-accent' : 'text-muted')}>
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cn('text-[11px] font-semibold', active ? 'text-fg' : 'text-muted')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Riel lateral para computador. */
export function SideRail() {
  const { route, navigate } = useApp();
  return (
    <nav className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-3 py-6 lg:flex" aria-label="Navegación principal">
      <div className="mb-8 flex items-center gap-2.5 px-3">
        <img src="/icons/icon.svg" alt="" className="size-9 rounded-xl" />
        <span className="text-lg font-extrabold tracking-tight">Mi Asistente</span>
      </div>
      {ITEMS.map(({ route: r, label, icon: Icon }) => (
        <button
          key={r}
          onClick={() => navigate(r)}
          aria-current={route === r ? 'page' : undefined}
          className={cn(
            'mb-1 flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition',
            route === r ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}
