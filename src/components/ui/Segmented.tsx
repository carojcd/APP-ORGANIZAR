import { cn } from '@/lib/cn';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ value, options, onChange, className, size = 'md' }: Props<T>) {
  return (
    <div role="tablist" className={cn('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-xl font-semibold transition',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
            o.value === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
