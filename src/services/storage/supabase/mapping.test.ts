import { describe, expect, it } from 'vitest';
import { buildItem } from '@/domain/items';
import { itemToRow, patchToRow, rowToItem } from './SupabaseProvider';

describe('mapeo Supabase ⇄ dominio', () => {
  it('ida y vuelta sin perder datos', () => {
    const item = buildItem({
      title: 'Pagar arriendo',
      categoryId: 'finance',
      date: '2026-11-30',
      time: '09:30',
      amount: 1_600_000,
      dueDate: '2026-11-30',
      reminder: { enabled: true, minutesBefore: 1440 },
      priority: 'high',
    });
    expect(rowToItem(itemToRow(item))).toEqual(item);
  });

  it('sin recordatorio se guarda como null', () => {
    const item = buildItem({ title: 'Comprar pan', categoryId: 'personal' });
    expect(itemToRow(item).reminder_minutes_before).toBeNull();
    expect(rowToItem(itemToRow(item)).reminder).toBeNull();
  });

  it('el parche solo incluye lo que cambia', () => {
    expect(patchToRow({ time: '15:00' })).toEqual({ time: '15:00' });
    expect(patchToRow({ reminder: null, dueDate: null })).toEqual({ reminder_minutes_before: null, due_date: null });
  });
});
