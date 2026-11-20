import { Plus } from 'lucide-react';

export function Fab({ onClick, label = 'Nuevo registro' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-[20px] bg-fg text-bg shadow-float transition active:scale-95 lg:bottom-8 lg:right-8"
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  );
}
