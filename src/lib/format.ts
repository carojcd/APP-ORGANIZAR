/**
 * Formatos visibles para Colombia: DD/MM/AAAA, 12 h con a. m./p. m., pesos COP.
 */
import { LOCALE } from '@/config/locale';
import type { DateKey, TimeKey } from '@/domain/types';
import { diffDays, parseDateKey, weekday } from './dates';

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "20/11/2026" */
export function formatDate(key: DateKey): string {
  const { year, month, day } = parseDateKey(key);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** "9:00 a. m." */
export function formatTime(time: TimeKey): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** "viernes, 20 de noviembre" */
export function formatLongDate(key: DateKey): string {
  const { month, day } = parseDateKey(key);
  return `${WEEKDAYS[weekday(key)]}, ${day} de ${MONTHS[month - 1]}`;
}

/** "Hoy", "Mañana", "Ayer", "Lunes 23/11" o "20/11/2026". */
export function formatRelativeDay(key: DateKey, today: DateKey): string {
  const d = diffDays(today, key);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  if (d > 1 && d < 7) {
    const { day, month } = parseDateKey(key);
    return `${cap(WEEKDAYS[weekday(key)])} ${pad(day)}/${pad(month)}`;
  }
  return formatDate(key);
}

/** Fecha relativa + hora, p. ej. "Mañana · 9:00 a. m." */
export function formatWhen(date: DateKey | null, time: TimeKey | null, today: DateKey): string {
  if (!date) return time ? formatTime(time) : 'Sin fecha';
  return time ? `${formatRelativeDay(date, today)} · ${formatTime(time)}` : formatRelativeDay(date, today);
}

const copFormatter = new Intl.NumberFormat(LOCALE.language, {
  style: 'currency',
  currency: LOCALE.currency,
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** "$ 350.000" */
export function formatCOP(amount: number): string {
  return copFormatter.format(amount).replace(/ /g, ' ');
}

/** "350.000" (sin símbolo; para campos de formulario). */
export function formatThousands(amount: number): string {
  return new Intl.NumberFormat(LOCALE.language, { maximumFractionDigits: 0 }).format(amount);
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: LOCALE.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export { cap as capitalize };
