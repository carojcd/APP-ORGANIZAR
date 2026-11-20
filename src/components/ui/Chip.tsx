import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: ReactNode;
  /** Id de categoría para teñir el chip activo. */
  cat?: string;
}

export function Chip({ active, icon, cat, className, children, ...rest }: Props) {
  return (
    <button
      data-cat={cat}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95',
        active
          ? cat
            ? 'border-transparent bg-[var(--c-soft)] text-[var(--c)]'
            : 'border-transparent bg-fg text-bg'
          : 'border-line bg-surface text-muted hover:text-fg',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
