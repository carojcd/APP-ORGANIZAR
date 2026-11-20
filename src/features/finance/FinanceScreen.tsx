import { useMemo, useState } from 'react';
import { HandCoins, Wallet } from 'lucide-react';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useApp } from '@/state/AppContext';
import { financeSummary, isOpen, isOverdue } from '@/state/selectors';
import { Card, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { ItemList } from '@/components/items/ItemList';
import { Fab } from '@/components/layout/Fab';
import { PageHeader, Screen } from '@/components/layout/PageHeader';

type Tab = 'pay' | 'collect' | 'done';

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'success' }) {
  return (
    <Card className="p-4">
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className={cn('mt-1 text-xl font-extrabold tracking-tight tabular', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>
        {formatCOP(value)}
      </p>
    </Card>
  );
}

export function FinanceScreen() {
  const { items, today, openEditor } = useApp();
  const [tab, setTab] = useState<Tab>('pay');
  const summary = useMemo(() => financeSummary(items, today), [items, today]);
  const finance = useMemo(() => items.filter((i) => i.categoryId === 'finance'), [items]);

  const list = useMemo(() => {
    if (tab === 'done') return finance.filter((i) => !isOpen(i)).reverse();
    return finance.filter((i) => isOpen(i) && (tab === 'collect' ? i.direction === 'collect' : i.direction !== 'collect'));
  }, [finance, tab]);
  const overdue = list.filter((i) => isOverdue(i, today));
  const upcoming = list.filter((i) => !isOverdue(i, today));
  const total = list.reduce((s, i) => s + (i.amount ?? 0), 0);

  return (
    <Screen>
      <PageHeader title="Pagos" subtitle="Finanzas" />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat label="Por pagar este mes" value={summary.payPendingMonth} />
        <Stat label="Vencido" value={summary.payOverdue} tone={summary.payOverdue ? 'danger' : undefined} />
        <Stat label="Por cobrar" value={summary.collectPending} tone="success" />
        <Stat label="Pagado este mes" value={summary.paidMonth} />
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pay', label: 'Por pagar' },
          { value: 'collect', label: 'Por cobrar' },
          { value: 'done', label: 'Pagados' },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'collect' ? <HandCoins size={24} /> : <Wallet size={24} />}
          title="Nada por aquí"
          text='Prueba diciéndole al asistente: "Agrega un pago de internet por $95.000 el 5".'
        />
      ) : (
        <>
          {tab !== 'done' && (
            <p className="mb-3 px-1 text-sm text-muted">
              Total: <b className="text-fg tabular">{formatCOP(total)}</b>
            </p>
          )}
          {overdue.length > 0 && tab !== 'done' && (
            <section className="mb-4">
              <SectionHeader title="Vencidos" count={overdue.length} />
              <Card className="border-danger/30 p-2"><ItemList items={overdue} /></Card>
            </section>
          )}
          <section>
            <SectionHeader title={tab === 'done' ? 'Historial' : 'Próximos'} count={tab === 'done' ? list.length : upcoming.length} />
            <Card className="p-2"><ItemList items={tab === 'done' ? list : upcoming} /></Card>
          </section>
        </>
      )}
      <Fab
        label="Nuevo pago"
        onClick={() => openEditor(null, { categoryId: 'finance', direction: tab === 'collect' ? 'collect' : 'pay', date: today })}
      />
    </Screen>
  );
}
