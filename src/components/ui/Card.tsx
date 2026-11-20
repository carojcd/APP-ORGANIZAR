import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-line bg-surface shadow-card', className)} {...rest} />;
}

export function SectionHeader({ title, action, count }: { title: string; action?: ReactNode; count?: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted tabular">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}
