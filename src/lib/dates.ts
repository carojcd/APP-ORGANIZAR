/**
 * Utilidades de fechas civiles en la zona horaria configurada (America/Bogota).
 *
 * Las fechas se manejan como claves "AAAA-MM-DD" (DateKey) para evitar errores
 * de zona horaria: la aritmética se hace sobre UTC puro y "hoy" se calcula
 * siempre con Intl en la zona de Bogotá, sin importar la zona del dispositivo.
 */
import { LOCALE } from '@/config/locale';
import type { DateKey, TimeKey } from '@/domain/types';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LOCALE.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(instant: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function makeDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseDateKey(value);
  return isValidDate(year, month, day);
}

export function isTimeKey(value: unknown): value is TimeKey {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Fecha de hoy en Bogotá. */
export function todayKey(now: Date = new Date()): DateKey {
  const p = zonedParts(now);
  return makeDateKey(p.year, p.month, p.day);
}

/** Hora actual en Bogotá "HH:mm". */
export function nowTimeKey(now: Date = new Date()): TimeKey {
  const p = zonedParts(now);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function toUtc(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): DateKey {
  return makeDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function addMonths(key: DateKey, months: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return makeDateKey(y, m, Math.min(day, daysInMonth(y, m)));
}

/** b - a en días. */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(key: DateKey): number {
  return toUtc(key).getUTCDay();
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(key: DateKey): DateKey {
  const wd = weekday(key);
  return addDays(key, -((wd + 6) % 7));
}

export function endOfWeek(key: DateKey): DateKey {
  return addDays(startOfWeek(key), 6);
}

export function startOfMonth(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return makeDateKey(year, month, 1);
}

export function endOfMonth(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return makeDateKey(year, month, daysInMonth(year, month));
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBetween(key: DateKey, from?: DateKey, to?: DateKey): boolean {
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

/**
 * Convierte fecha + hora civil de Bogotá a un instante absoluto.
 * Calcula el desfase real de la zona (Bogotá es UTC-5 sin horario de verano,
 * pero el cálculo no lo da por sentado).
 */
export function toInstant(date: DateKey, time: TimeKey | null): Date {
  const { year, month, day } = parseDateKey(date);
  const [h, m] = (time ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, h, m);
  const p = zonedParts(new Date(guess));
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(guess - (asIfUtc - guess));
}

export function weekDays(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
