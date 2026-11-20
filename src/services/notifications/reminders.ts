/**
 * Calcula qué recordatorios vencieron. Limitación de esta etapa: solo
 * funciona con la app abierta; las notificaciones push con la app cerrada
 * llegarán con Firebase Cloud Messaging.
 */
import { effectiveDate } from '@/domain/items';
import type { Item } from '@/domain/types';
import { toInstant } from '@/lib/dates';

/** Hora usada para recordatorios de registros sin hora. */
export const DEFAULT_REMINDER_TIME = '08:00';
const MAX_LATE_MS = 6 * 60 * 60 * 1000;

export function reminderInstant(item: Item): Date | null {
  const date = effectiveDate(item);
  if (!item.reminder?.enabled || !date) return null;
  const at = toInstant(date, item.time ?? DEFAULT_REMINDER_TIME);
  return new Date(at.getTime() - item.reminder.minutesBefore * 60_000);
}

export function dueReminders(items: Item[], now: Date, alreadySent: Set<string>): { item: Item; key: string }[] {
  const out: { item: Item; key: string }[] = [];
  for (const item of items) {
    if (item.status === 'done') continue;
    const at = reminderInstant(item);
    if (!at) continue;
    const key = `${item.id}@${at.toISOString()}`;
    const late = now.getTime() - at.getTime();
    if (late >= 0 && late < MAX_LATE_MS && !alreadySent.has(key)) out.push({ item, key });
  }
  return out;
}
