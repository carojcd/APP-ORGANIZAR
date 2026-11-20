import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'bg-surface-2 text-fg hover:bg-line',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:opacity-85',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-2xl',
  lg: 'h-13 px-5 text-base gap-2 rounded-2xl',
};

export function Button({ variant = 'primary', size = 'md', icon, block, className, children, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition active:scale-[0.98] disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'accent' | 'soft';
  size?: 'sm' | 'md' | 'lg';
}

export function IconButton({ label, tone = 'default', size = 'md', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40',
        size === 'sm' ? 'size-9' : size === 'lg' ? 'size-12' : 'size-10',
        tone === 'accent' && 'bg-accent text-accent-fg',
        tone === 'soft' && 'bg-surface-2 text-fg hover:bg-line',
        tone === 'default' && 'text-muted hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
