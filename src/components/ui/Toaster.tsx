import { CircleAlert, CircleCheck } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { cn } from '@/lib/cn';

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-float animate-fade-up',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-fg text-bg',
          )}
        >
          {t.tone === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} className="opacity-80" />}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              className="font-bold text-accent-soft underline-offset-2 hover:underline dark:text-indigo-600"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
