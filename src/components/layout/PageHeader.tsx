import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-5">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] font-semibold text-muted">{subtitle}</p>}
        <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

/** Contenedor estándar de pantalla con márgenes y espacio para la barra inferior. */
export function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(110px+env(safe-area-inset-bottom))] pt-safe lg:pb-12">{children}</main>;
}
