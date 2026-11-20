/** Consultas derivadas sobre la lista de registros (puras, memorizables). */
import { effectiveDate } from '@/domain/items';
import type { Item } from '@/domain/types';
import { addDays, endOfMonth, startOfMonth } from '@/lib/dates';

export const isOpen = (i: Item) => i.status !== 'done';
export const isOverdue = (i: Item, today: string) => {
  const d = effectiveDate(i);
  return isOpen(i) && d !== null && d < today;
};

export function itemsOn(items: Item[], date: string): Item[] {
  return items.filter((i) => effectiveDate(i) === date);
}

export function daySummary(items: Item[], today: string) {
  const todays = itemsOn(items, today);
  const done = todays.filter((i) => i.status === 'done').length;
  return {
    total: todays.length,
    done,
    pending: todays.length - done,
    overdue: items.filter((i) => isOverdue(i, today)).length,
  };
}

/** Pagos y entregas abiertos que vencen en los próximos `days` días (incluye vencidos). */
export function upcomingDeadlines(items: Item[], today: string, days = 10): Item[] {
  const limit = addDays(today, days);
  return items.filter((i) => {
    if (!isOpen(i)) return false;
    const due = i.dueDate ?? (i.categoryId === 'finance' ? i.date : null);
    return due !== null && due <= limit;
  });
}

export function financeSummary(items: Item[], today: string) {
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const finance = items.filter((i) => i.categoryId === 'finance' && i.amount != null);
  const inMonth = (i: Item) => {
    const d = effectiveDate(i);
    return d !== null && d >= from && d <= to;
  };
  const sum = (list: Item[]) => list.reduce((s, i) => s + (i.amount ?? 0), 0);
  const pay = finance.filter((i) => i.direction !== 'collect');
  const collect = finance.filter((i) => i.direction === 'collect');
  return {
    payPendingMonth: sum(pay.filter((i) => isOpen(i) && inMonth(i))),
    payOverdue: sum(pay.filter((i) => isOverdue(i, today))),
    collectPending: sum(collect.filter(isOpen)),
    paidMonth: sum(pay.filter((i) => !isOpen(i) && inMonth(i))),
    countPendingMonth: pay.filter((i) => isOpen(i) && inMonth(i)).length,
  };
}
